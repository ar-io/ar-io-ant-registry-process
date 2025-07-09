local json = require(".common.json")
local utils = require(".common.utils")
local main = {}
-- just to ignore lint warnings
local ao = ao or {}

---@alias ACL { Owned: string[], Controlled: string[] }
---@alias ACLMap {[string]: ACL}
---@alias ANT { Owner: string, Controllers: {[string]: boolean} }
---@alias ANTMap {[string]: ANT}
---@alias AddressMap {[string]: {[string]: boolean}}
---@alias VersionMap {[string]: { messageId: string, moduleId: string, luaSourceId: string, notes: string }}

main.init = function()
	-- Example ANT structure
	-- ANTS["antId"] = {
	--     Owner = "userId",
	--     Controllers = {"userId1" = true, "userId2" = true},
	-- }
	---@type ANTMap
	ANTS = ANTS or {}

	-- Example ADDRESSES structure - maps a user address to a table keyed on ANT process IDs
	-- ADDRESSES["userAddress"] = {"antProcessId1" = true, "antProcessId2" = true}
	---@type AddressMap
	ADDRESSES = ADDRESSES or {}

	-- Example ANTVersions structure - maps a version number to a table with the messageId, moduleId, luaSourceId, and notes
	-- ANTVersions["1"] = { messageId = "messageId1", moduleId = "moduleId1", luaSourceId = "luaSourceId1", notes = "notes1" }
	---@type VersionMap
	ANTVersions = ANTVersions or {}

	local ActionMap = {
		Register = "Register",
		Unregister = "Unregister",
		StateNotice = "State-Notice",
		AccessControlList = "Access-Control-List",
		AddVersion = "Add-Version",
		RemoveVersion = "Remove-Version",
		GetVersions = "Get-Versions",
	}

	utils.createActionHandler(ActionMap.Register, function(msg)
		local antId = msg.Tags["Process-Id"]
		assert(type(antId) == "string", "Process-Id is required")

		ao.send({
			Target = antId,
			Action = "State",
		})
		ao.send({
			Target = msg.From,
			Action = "Register-Notice",
			["Message-Id"] = msg.Id,
		})
	end)

	utils.createActionHandler(ActionMap.Unregister, function(msg)
		local antId = msg.Tags["Process-Id"]
		assert(type(antId) == "string", "Process-Id is required")

		-- generate the acl here so we can path to the relevant addresses in the mappings
		local acl = utils.patchAffiliationsForAnt(antId, ANTS)

		utils.unregisterAnt(msg.From, ANTS, antId, ADDRESSES)
		ao.send({
			Target = msg.From,
			Action = "Unregister-Notice",
			["Message-Id"] = msg.Id,
		})
		-- Send HyperBEAM patch message with updated ACL that has the ant removed

		ao.send({
			device = "patch@1.0",
			cache = { acl = acl },
		})
	end)

	utils.createActionHandler(ActionMap.StateNotice, function(msg)
		local ant = utils.parseAntState(msg.Data)
		-- we pass in the reference as the state nonce
		local updateResult = utils.updateAffiliations(msg.From, ant, ADDRESSES, ANTS, tonumber(msg.Reference))
		local affiliatesToRemoveAntIdFrom = updateResult.affiliatesToRemoveAntIdFrom

		-- this may need to be batched for operation within limits of hyperbeam messages, specifically http header size
		local aclMap = utils.affiliationsForAnt(msg.From, ANTS)

		for _, affiliate in ipairs(affiliatesToRemoveAntIdFrom) do
			aclMap[affiliate] = utils.affiliationsForAddress(affiliate, ANTS)
			-- TODO: DELETE the ant from the affiliations on the address mapping. Currently do not know how to do this, or if its even possible with the current state of patch@1.0\
			-- this will set the mapping to { Owned: [], Controlled: [] } in the hb state

			-- aclMap[affiliate].Owned[utils.indexOf(aclMap[affiliate].Owned, msg.From)] = nil
			-- aclMap[affiliate].Controlled[utils.indexOf(aclMap[affiliate].Controlled, msg.From)] = nil
		end

		ao.send({
			device = "patch@1.0",
			cache = { acl = aclMap },
		})
	end)

	utils.createActionHandler(ActionMap.AccessControlList, function(msg)
		local address = msg.Tags["Address"]
		assert(type(address) == "string", "Address is required")

		-- Send the affiliations table
		ao.send({
			Target = msg.From,
			Action = "Access-Control-List-Notice",
			["Message-Id"] = msg.Id,
			Data = json.encode(utils.affiliationsForAddress(address, ANTS)),
		})
	end)

	utils.createActionHandler(ActionMap.AddVersion, function(msg)
		assert(msg.From == Owner, "Only ANT Registry owner can add versions")
		local version = tonumber(msg.Version)
		local moduleId = msg["Module-Id"]
		local luaSourceId = msg["Lua-Source-Id"]
		local notes = msg.Notes or ""

		assert(
			version ~= nil and math.type(version) == "integer" and version >= 0,
			"Version must be a positive integer, recieved " .. tostring(version)
		)
		utils.validateArweaveId(moduleId)
		assert(
			type(luaSourceId) == "string" and utils.validateArweaveId(luaSourceId) or luaSourceId == nil,
			"Lua-Source-Id should be a valid arweave ID"
		)
		assert(type(notes) == "string", "Notes must be a string")

		ANTVersions[tostring(version)] =
			{ messageId = msg.Id, moduleId = moduleId, luaSourceId = luaSourceId, notes = notes }

		ao.send({
			Target = msg.From,
			Action = "Add-Version-Notice",
			["Message-Id"] = msg.Id,
			Data = json.encode(ANTVersions),
		})
	end)

	utils.createActionHandler(ActionMap.RemoveVersion, function(msg)
		assert(msg.From == Owner, "Only ANT Registry owner can add versions")
		local version = tostring(msg.Version)

		assert(ANTVersions[version], "Version " .. version .. " does not exist")

		ANTVersions[version] = nil
		ao.send({
			Target = msg.From,
			Action = "Remove-Version-Notice",
			["Message-Id"] = msg.Id,
			Data = json.encode(ANTVersions),
		})
	end)

	utils.createActionHandler(ActionMap.GetVersions, function(msg)
		ao.send({
			Target = msg.From,
			Action = "Get-Versions-Notice",
			["Message-Id"] = msg.Id,
			Data = json.encode(ANTVersions),
		})
	end)
end

return main
