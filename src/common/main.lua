local json = require(".common.json")
local utils = require(".common.utils")
local main = {}
-- just to ignore lint warnings
local ao = ao or {}

main.init = function()
	ANT_REGISTRATION_TTL = 1000 * 60 * 30 -- 30 minutes
	-- Example ANT structure
	-- ANTS["antId"] = {
	--     Owner = "userId",
	--     Controllers = {"userId1" = true, "userId2" = true},
	-- }
	ANTS = ANTS or {}

	-- Example ADDRESSES structure - keyed references to the above ANTS structure
	-- ADDRESSES["userAddress"] = {"antProcessId1" = true, "antProcessId2" = true}
	ADDRESSES = ADDRESSES or {}

	local ActionMap = {
		Register = "Register",
		StateNotice = "State-Notice",
		AccessControlList = "Access-Control-List",
	}

	utils.createActionHandler(ActionMap.Register, function(msg)
		local antId = msg.Tags["Process-Id"]
		assert(type(antId) == "string", "Process-Id tag is required")
		assert(ANTS[antId] == nil, "ANT is already registered")

		utils.register({
			id = antId,
			timestamp = tonumber(msg.Timestamp),
		})
		--[[
			Send a request message for current ANT state to the process. Expect back 
			a State-Notice so that we can update the registered ANT settings.
		]]
		ao.send({
			Target = antId,
			Action = "State",
		})
		ao.send({
			Target = msg.From,
			Action = "Register-Notice",
		})
	end)

	utils.createActionHandler(ActionMap.StateNotice, function(msg)
		local stateRes = utils.parseAntState(msg.Data)
		-- Check if already registered
		local isRegistered = ANTS[msg.From] ~= nil

		-- Register the ANT if not already registered
		if not isRegistered then
			utils.register({
				id = msg.From,
				timestamp = tonumber(msg.Timestamp),
				owner = stateRes.Owner,
				controllers = stateRes.Controllers,
			})
		end

		utils.updateAssociations(msg.From, stateRes)

		-- Notify the ANT that it has been registered
		if not isRegistered then
			ao.send({
				Target = msg.From,
				Action = "Register-Notice",
				["Message-Id"] = msg.Id,
			})
		end
	end)

	utils.createActionHandler(ActionMap.AccessControlList, function(msg)
		local address = msg.Tags["Address"]
		assert(type(address) == "string", "Address is required")

		local antIds = {}
		if ADDRESSES[address] then
			for antId, _ in pairs(ADDRESSES[address]) do
				table.insert(antIds, antId)
			end
		end

		-- Send the list of ant_ids as a JSON array
		ao.send({
			Target = msg.From,
			Action = "Access-Control-List-Notice",
			["Message-Id"] = msg.Id,
			Data = json.encode(antIds),
		})
	end)

	Handlers.prepend("cleanOldRegistrations", function(msg)
		return "continue"
	end, function(msg)
		utils.cleanAnts(tonumber(msg.Timestamp))
	end)
end

return main
