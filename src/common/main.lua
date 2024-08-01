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

	REQUESTED_ANTS = REQUESTED_ANTS or {}
	ANTS_WAITING_RESPONSE = ANTS_WAITING_RESPONSE or {}

	local ActionMap = {
		Register = "Register",
		StateNotice = "State-Notice",
		AccessControlList = "Access-Control-List",
	}

	utils.createActionHandler(ActionMap.Register, function(msg)
		local antId = msg.Tags["Process-Id"]
		assert(type(antId) == "string", "Process-Id is required")

		REQUESTED_ANTS[antId] = true
		ANTS_WAITING_RESPONSE[antId] = true

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
		ANTS_WAITING_RESPONSE[msg.From] = nil
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
end

return main
