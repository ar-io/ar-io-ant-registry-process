local json = require(".common.json")
local utils = require(".common.utils")
local main = {}
-- just to ignore lint warnings
local ao = ao or {}

local camel = utils.camelCase

local function errorHandler(err)
	return debug.traceback(err)
end

main.init = function()
	ANTS = ANTS or {}
	-- Example ANT structure
	-- ANTS["antId"] = {
	--     Owner = "userId",
	--     Controllers = {"userId1", "userId2"},
	-- }
	USERS = USERS or {}
	-- Example USERS structure
	-- USERS["userId"] = {"antId1", "antId2"}

	local ActionMap = {
		Register = "Register",
		StateNotice = "State-Notice",
		AccessControlList = "Access-Control-List",
	}

	Handlers.add(camel(ActionMap.Register), Handlers.utils.hasMatchingTag("Action", ActionMap.Register), function(msg)
		print("Action: " .. ActionMap.Register)

		local antId = msg.Tags["Process-Id"]
		assert(type(antId) == "string", "Process-Id tag is required")

		if ANTS[antId] then
			ao.send({
				Target = msg.From,
				Action = "Register-Notice-Failure",
				["Message-Id"] = msg.Id,
				Data = "ANT is already registered",
			})
		else
			ANTS[antId] = {
				Owner = nil,
				Controllers = {},
			}

			ao.send({
				Target = antId,
				Action = "State",
			})
			ao.send({
				Target = msg.From,
				Action = "Register-Notice",
			})
		end
	end)

	Handlers.add(
		camel(ActionMap.StateNotice),
		Handlers.utils.hasMatchingTag("Action", ActionMap.StateNotice),
		function(msg)
			print("Action: " .. ActionMap.StateNotice)

			local stateStatus, stateRes = xpcall(function()
				return utils.parseAntState(msg.Data)
			end, errorHandler)
			if not stateStatus then
				ao.send({
					Target = msg.From,
					Action = "State-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = tostring(stateRes),
				})
				return
			end

			-- Check if already registered
			local isRegistered = ANTS[msg.From] ~= nil

			-- Register the ANT if not already registered
			if not isRegistered then
				ANTS[msg.From] = {
					Owner = stateRes.Owner,
					Controllers = {},
					-- for cleaning function
					RegisteredAt = tonumber(msg.Timestamp),
				}
			end

			local aclUpdateStatus, aclUpdateRes = xpcall(function()
				return utils.updateAssociations(msg.From, stateRes)
			end, errorHandler)
			if not aclUpdateStatus then
				ao.send({
					Target = msg.From,
					Action = "State-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = aclUpdateRes,
				})
				return
			end

			-- Notify the ANT that it has been registered
			if not isRegistered then
				ao.send({
					Target = msg.From,
					Action = "Register-Notice",
					["Message-Id"] = msg.Id,
				})
			end
		end
	)

	Handlers.add(
		camel(ActionMap.AccessControlList),
		Handlers.utils.hasMatchingTag("Action", ActionMap.AccessControlList),
		function(msg)
			print("Action: " .. ActionMap.AccessControlList)

			local address = msg.Tags["Address"]
			assert(type(address) == "string", "Address is required")

			local antIds = USERS[address] or {}

			-- Send the list of ant_ids as a JSON array
			ao.send({
				Target = msg.From,
				Action = "Access-Control-List-Notice",
				["Message-Id"] = msg.Id,
				Data = json.encode(antIds),
			})
		end
	)

	Handlers.prepend("cleanOldRegistrations", function(msg)
		return "continue"
	end, function(msg)
		utils.cleanAnts(tonumber(msg.Timestamp))
	end)
end

return main
