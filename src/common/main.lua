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

	ANTVersions = ANTVersions
		or {
			["1.0.0"] = {
				module = "pb4fCvdJqwT-_bn38ERMdqnOF4weRMjoJ6bY6yfl4a8",
				luaSource = "OO2ewZKq4AHoqGQmYUIl-NhJ-llQyFJ3ha4Uf4-w5RI",
			},
		}

	local ActionMap = {
		Register = "Register",
		StateNotice = "State-Notice",
		AccessControlList = "Access-Control-List",
		AddVersion = "Add-Version",
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
		utils.updateAffiliations(msg.From, ant, ADDRESSES, ANTS)
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
		local version = msg.Version
		local module = msg["Module-Id"]
		local luaSource = msg["Lua-Source-Id"]

		utils.validateSemver(version)
		utils.validateArweaveId(module)
		assert(
			type(luaSource) == "string" and utils.validateArweaveId(luaSource) or luaSource == nil,
			"Lua-Source-Id should be a valid arweave ID"
		)
		assert(not ANTVersions[version], "Version " .. tostring(version) .. " already exists")

		local newVersionData = { module = module, luaSource = luaSource }

		ANTVersions[version] = newVersionData

		ao.send({
			Target = msg.From,
			Action = "Add-Version-Notice",
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
