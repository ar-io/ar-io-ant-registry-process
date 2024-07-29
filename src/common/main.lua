local json = require(".common.json")
local sqlite3 = require("lsqlite3")
local dbAdmin = require(".common.db.admin")
local utils = require(".common.utils")
local main = {}
-- just to ignore lint warnings
local ao = ao or {}

local camel = utils.camelCase
main.init = function()
	-- Create a new in-memory database
	ANT_DB_ADMIN = ANT_DB_ADMIN or dbAdmin.new(sqlite3.open_memory())

	ANT_DB_ADMIN:init()

	local ActionMap = {
		Register = "Register",
		StateNotice = "State-Notice",
		AccessControlList = "Access-Control-List",
	}

	Handlers.add(
		camel(ActionMap.Register),
		Handlers.utils.hasMatchingTag("Action", ActionMap.Register),
		ANT_DB_ADMIN:createSafeTransaction(function(msg)
			print("Action: " .. ActionMap.Register)

			local antId = msg.Tags["Process-Id"]
			assert(type(antId) == "string", "Process-Id tag is required")

			local registerStatus, registerRes =
				pcall(ANT_DB_ADMIN.register, ANT_DB_ADMIN, antId, tonumber(msg.Timestamp))
			if not registerStatus then
				ao.send({
					Target = msg.From,
					Action = "Register-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = tostring(registerRes),
				})
				error(registerRes)
			end

			ao.send({
				Target = antId,
				Action = "State",
			})
			ao.send({
				Target = msg.From,
				Action = "Register-Notice",
			})
		end)
	)

	Handlers.add(
		camel(ActionMap.StateNotice),
		Handlers.utils.hasMatchingTag("Action", ActionMap.StateNotice),
		ANT_DB_ADMIN:createSafeTransaction(function(msg)
			print("Action: " .. ActionMap.StateNotice)
			local stateStatus, stateRes = pcall(utils.parseAntState, msg.Data)
			if not stateStatus then
				ao.send({
					Target = msg.From,
					Action = "State-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = tostring(stateRes),
				})
				error(stateRes)
			end

			-- Check if already registered and send notice of registration if not registered
			local isRegisteredStatus, isRegisteredRes = pcall(ANT_DB_ADMIN.isRegistered, ANT_DB_ADMIN, msg.From)
			if not isRegisteredStatus then
				ao.send({
					Target = msg.From,
					Action = "State-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = isRegisteredRes,
				})
				error(isRegisteredRes)
			end
			-- Register the ANT and send a notice if it is not already registered
			if isRegisteredRes == false then
				local registrationStatus, registrationRes =
					pcall(ANT_DB_ADMIN.register, ANT_DB_ADMIN, msg.From, tonumber(msg.Timestamp))
				if not registrationStatus then
					ao.send({
						Target = msg.From,
						Action = "Register-Notice-Failure",
						["Message-Id"] = msg.Id,
						Data = registrationRes,
					})
					error(registrationRes)
				end
			end

			local aclUpdateStatus, aclUpdateRes =
				pcall(ANT_DB_ADMIN.updateACL, ANT_DB_ADMIN, msg.From, stateRes, tonumber(msg.Timestamp))

			if not aclUpdateStatus then
				ao.send({
					Target = msg.From,
					Action = "State-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = aclUpdateRes,
				})
				error(aclUpdateRes)
			end

			-- notify the ant that it has been registered in this action
			if isRegisteredRes == false then
				ao.send({
					Target = msg.From,
					Action = "Register-Notice",
					["Message-Id"] = msg.Id,
				})
			end
		end)
	)

	Handlers.add(
		camel(ActionMap.AccessControlList),
		Handlers.utils.hasMatchingTag("Action", ActionMap.AccessControlList),
		ANT_DB_ADMIN:createSafeTransaction(function(msg)
			print("Action: " .. ActionMap.AccessControlList)
			local address = msg.Tags["Address"]
			assert(address, "Address is required")

			local antIdsStatus, antIdsRes = pcall(ANT_DB_ADMIN.getAntsByAddress, ANT_DB_ADMIN, address)

			if not antIdsStatus then
				ao.send({
					Target = msg.From,
					Action = "Access-Control-List-Failure",
					["Message-Id"] = msg.Id,
					Data = antIdsRes,
				})
				error(antIdsRes)
			end

			-- Send the list of ant_ids as a JSON array
			ao.send({
				Target = msg.From,
				Action = "Access-Control-List-Notice",
				["Message-Id"] = msg.Id,
				Data = json.encode(antIdsRes),
			})
		end)
	)
end

return main
