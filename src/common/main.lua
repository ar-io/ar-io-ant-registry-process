local json = require(".common.json")
local utils = require(".common.utils")
local main = {}
-- just to ignore lint warnings
local ao = ao or {}

main.init = function()
	-- Example ANT structure
	-- ANTS["antId"] = {
	--     Owner = "userId",
	--     Controllers = {"userId1" = true, "userId2" = true},
	-- }
	ANTS = ANTS or {}

	-- Example ADDRESSES structure - maps a user address to a table keyed on ANT process IDs
	-- ADDRESSES["userAddress"] = {"antProcessId1" = true, "antProcessId2" = true}
	ADDRESSES = ADDRESSES or {}

	ANTVersions = ANTVersions or {}

	local ActionMap = {
		Register = "Register",
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

	utils.createActionHandler(ActionMap.StateNotice, function(msg)
		local ant = utils.parseAntState(msg.Data)
		-- we pass in the reference as the state nonce
		utils.updateAffiliations(msg.From, ant, ADDRESSES, ANTS, tonumber(msg.Reference))
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
