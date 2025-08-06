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
		BatchUnregister = "Batch-Unregister",
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
		local acl = utils.generateAffiliationsDelta(antId, ANTS)

		utils.unregisterAnt(msg.From, ANTS, antId, ADDRESSES)
		ao.send({
			Target = msg.From,
			Action = "Unregister-Notice",
			["Message-Id"] = msg.Id,
		})
		-- Send HyperBEAM patch message with updated ACL that has the ant removed
		-- only send if the acl is not empty, as we will nuke the entire ACL from the patch device if it is empty
		if #utils.keys(acl) > 0 then
			ao.send({
				device = "patch@1.0",
				cache = { acl = acl },
			})
		end
	end)

	utils.createActionHandler(ActionMap.BatchUnregister, function(msg)
		assert(msg.From == Owner, "Only ANT Registry owner can batch unregister")
		local antIds = json.decode(msg.Data)
		assert(
			type(antIds) == "table" and #antIds > 0 and utils.validateArweaveId(antIds[1]),
			"msg.Data must be a table of antIds, recieved " .. type(antIds)
		)

		--- for the patch device
		local patchAcl = {}
		--- At the end of the loop, if there are any errors, we will send a notice to the owner with the error
		--- messages for each antId that had an error.
		local antIdErrorMap = {}
		--- we do this to skip over duplicate antIds in the array
		--- these would error out because we already unregistered them
		local visitedAntIds = {}

		for _, antId in ipairs(antIds) do
			--- if we have already visited this antId, we skip it
			if not visitedAntIds[antId] then
				visitedAntIds[antId] = true
				assert(utils.validateArweaveId(antId) ~= false, "Invalid antId: " .. tostring(antId))

				-- generate the acl here so we can path to the relevant addresses in the mappings
				-- only apply to the patchAcl if unregister succeeds
				-- pcall because generateAffiliationsDelta can error out if the antId is not registered
				local deltaStatus, deltaAcl = xpcall(function()
					return utils.generateAffiliationsDelta(antId, ANTS)
				end, utils.errorHandler)

				--- It may be the case that a non existant ANT was passed in, so we need to handle the error to prevent
				--- the entire batch unregister from failing unnecessarily.
				local unregisterStatus, unregisterRes = xpcall(function()
					return utils.unregisterAnt(msg.From, ANTS, antId, ADDRESSES)
				end, utils.errorHandler)

				if not unregisterStatus or not deltaStatus then
					-- unregister failed, so we add the error to the map
					antIdErrorMap[antId] = unregisterRes or deltaStatus
				else
					-- unregister succeeded, so we apply the delta to the patchAcl
					for address, newAcl in pairs(deltaAcl) do
						patchAcl[address] = newAcl
					end
				end
			end
		end

		if #utils.keys(antIdErrorMap) > 0 then
			ao.send({
				Target = msg.From,
				Action = "Invalid-Batch-Unregister-Notice",
				["Message-Id"] = msg.Id,
				Error = #antIdErrorMap .. " ANTs out of " .. #visitedAntIds .. " failed to unregister",
				Data = json.encode(antIdErrorMap),
			})
		else
			ao.send({
				Target = msg.From,
				Action = "Batch-Unregister-Notice",
				["Message-Id"] = msg.Id,
			})
		end

		--- we need to make sure that the patchAcl is not empty, other we will nuke the entire ACL from the patch device
		if #utils.keys(patchAcl) > 0 then
			-- Send HyperBEAM patch message with updated ACL that has the ant removed
			ao.send({
				device = "patch@1.0",
				cache = { acl = patchAcl },
			})
		end
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

		-- only send if the aclMap is not empty, as we will nuke the entire ACL from the patch device if it is empty
		if #utils.keys(aclMap) > 0 then
			ao.send({
				device = "patch@1.0",
				cache = { acl = aclMap },
			})
		end
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
		local releaseTimestamp = tonumber(msg.Timestamp)

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

		ANTVersions[tostring(version)] = {
			messageId = msg.Id,
			moduleId = moduleId,
			luaSourceId = luaSourceId,
			notes = notes,
			releaseTimestamp = releaseTimestamp,
		}

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
