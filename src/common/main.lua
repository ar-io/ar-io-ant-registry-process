local json = require(".common.json")
local sqlite3 = require("lsqlite3")
local dbAdmin = require(".common.db.admin")
local utils = require(".common.utils")
local main = {}

local camel = utils.camelCase
main.init = function()
	-- Create a new in-memory database
	ANT_DB_ADMIN = ANT_DB_ADMIN or dbAdmin.new(sqlite3.open_memory())

	-- Execute table creation statements separately
	local create_ant_index_sql = [[
        CREATE TABLE IF NOT EXISTS ant_index (
            ant_id TEXT PRIMARY KEY NOT NULL, 
            owner TEXT NOT NULL,
            registered_at INTEGER NOT NULL
        );
    ]]
	local create_ant_controllers_sql = [[
        CREATE TABLE IF NOT EXISTS ant_controllers (
            ant_id TEXT NOT NULL,
            controller TEXT NOT NULL,
            PRIMARY KEY (ant_id, controller),
            FOREIGN KEY (ant_id) REFERENCES ant_index (ant_id)
        );
    ]]

	-- Execute the creation of ant_index table
	local exec_status1 = ANT_DB_ADMIN:exec(create_ant_index_sql)
	if exec_status1 ~= sqlite3.OK then
		print("ant_index table creation failed: " .. ANT_DB_ADMIN.db:errmsg())
	else
		print("ant_index table created successfully")
	end

	-- Execute the creation of ant_controllers table
	local exec_status2 = ANT_DB_ADMIN:exec(create_ant_controllers_sql)
	if exec_status2 ~= sqlite3.OK then
		print("ant_controllers table creation failed: " .. ANT_DB_ADMIN.db:errmsg())
	else
		print("ant_controllers table created successfully")
	end

	local ActionMap = {
		Register = "Register",
		StateNotice = "State-Notice",
		AccessControlList = "Access-Control-List",
		GetAllAnts = "Get-All-Ants", -- New action
	}

	Handlers.add(camel(ActionMap.Register), Handlers.utils.hasMatchingTag("Action", ActionMap.Register), function(msg)
		local antId = msg.Tags["Process-Id"]
		assert(antId, "Process-Id tag is required")

		local idStatus, idRes = pcall(utils.validateArweaveId, antId)
		if not idStatus then
			ao.send({
				Target = msg.From,
				Action = "Register-Notice-Failure",
				["Message-Id"] = msg.Id,
				Data = tostring(idRes),
			})
			return -- Exit the function if validation fails
		end

		-- Prepare the SQL statement with parameters to avoid SQL injection
		local stmt = ANT_DB_ADMIN.db:prepare("INSERT INTO ant_index (ant_id, owner, registered_at) VALUES (?, ?, ?)")
		local timestamp = tonumber(msg.Timestamp)

		if stmt then
			print("Preparing to insert ANT " .. antId .. " : timestamp: " .. timestamp)
			stmt:bind_values(antId, "unknown", timestamp) -- Changed `nil` to "unknown"
			local insertStatus, insertRes = pcall(stmt.step, stmt)
			if insertStatus then
				print("ANT inserted: " .. antId)
			else
				print("Insert failed: " .. insertRes)
			end
			stmt:finalize()
		else
			print("Failed to prepare insert statement: " .. ANT_DB_ADMIN.db:errmsg())
			ao.send({
				Target = msg.From,
				Action = "Register-Notice-Failure",
				["Message-Id"] = msg.Id,
				Data = "Failed to prepare SQL statement",
			})
			return -- Exit the function if preparation fails
		end

		-- Verify insertion
		local verify_stmt = ANT_DB_ADMIN.db:prepare("SELECT * FROM ant_index WHERE ant_id = ?")
		if verify_stmt then
			verify_stmt:bind_values(antId)
			for row in verify_stmt:nrows() do
				print("Inserted ANT: " .. row.ant_id .. " owner: " .. row.owner .. " timestamp: " .. row.registered_at)
			end
			print("Finalizing verify")
			verify_stmt:finalize()
		else
			print("Failed to prepare verify statement: " .. ANT_DB_ADMIN.db:errmsg())
		end

		-- Send success notifications
		ao.send({
			Target = antId,
			Action = "State",
		})
		ao.send({
			Target = msg.From,
			Action = "Register-Notice",
		})
	end)

	Handlers.add(
		camel(ActionMap.StateNotice),
		Handlers.utils.hasMatchingTag("Action", ActionMap.StateNotice),
		function(msg)
			local stateStatus, stateRes = pcall(utils.parseAntState, msg.Data)
			if not stateStatus then
				ao.send({
					Target = msg.From,
					Action = "State-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = tostring(stateRes),
				})
				return -- Exit the function if parsing fails
			end

			-- Check if already registered
			local registered_stmt = ANT_DB_ADMIN.db:prepare("SELECT owner FROM ant_index WHERE ant_id = ?")
			local isRegistered = false

			if registered_stmt then
				registered_stmt:bind_values(msg.From)
				local selectStatus, selectRes = pcall(registered_stmt.step, registered_stmt)

				if selectStatus and selectRes == sqlite3.ROW then
					isRegistered = true
				end
				registered_stmt:finalize()
			else
				ao.send({
					Target = msg.From,
					Action = "State-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = "Failed to prepare SQL statement",
				})
				return -- Exit the function if preparation fails
			end

			-- Update registered ant ID with owner from state or register ant if not registered
			local owner_stmt = ANT_DB_ADMIN.db:prepare(
				"INSERT OR REPLACE INTO ant_index (ant_id, owner, registered_at) VALUES (?, ?, ?)"
			)

			if owner_stmt then
				owner_stmt:bind_values(msg.From, stateRes.Owner, tonumber(msg.Timestamp))
				local insertStatus, insertRes = pcall(owner_stmt.step, owner_stmt)
				if insertStatus then
					print("StateNotice updated ANT: " .. msg.From)
				else
					print("StateNotice update failed: " .. insertRes)
				end
				owner_stmt:finalize()
			else
				ao.send({
					Target = msg.From,
					Action = "State-Notice-Failure",
					["Message-Id"] = msg.Id,
					Data = "Failed to prepare SQL statement",
				})
				return -- Exit the function if preparation fails
			end

			-- Verify update or insertion
			local verify_stmt = ANT_DB_ADMIN.db:prepare("SELECT * FROM ant_index")
			if verify_stmt then
				print("Contents of ant_index after StateNotice update:")
				for row in verify_stmt:nrows() do
					print("ANT: " .. row.ant_id .. " owner: " .. row.owner .. " timestamp: " .. row.registered_at)
				end
				verify_stmt:finalize()
			else
				print("Failed to prepare verify statement: " .. ANT_DB_ADMIN.db:errmsg())
			end

			-- Insert or update controllers
			for _, controller in ipairs(stateRes.Controllers) do
				local controllers_stmt =
					ANT_DB_ADMIN.db:prepare("INSERT OR REPLACE INTO ant_controllers (ant_id, controller) VALUES (?, ?)")
				if not controllers_stmt then
					print("SQL Error (controllers_stmt preparation): " .. ANT_DB_ADMIN.db:errmsg())
				end
				if controllers_stmt then
					controllers_stmt:bind_values(msg.From, controller)
					local insertStatus, insertRes = pcall(controllers_stmt.step, controllers_stmt)
					if insertStatus then
						print("Controller inserted: " .. msg.From .. " " .. controller)
					else
						print("Controller insert failed: " .. insertRes)
					end
					controllers_stmt:finalize()
				else
					ao.send({
						Target = msg.From,
						Action = "State-Notice-Failure",
						["Message-Id"] = msg.Id,
						Data = "Failed to prepare SQL statement for controllers",
					})
					return -- Exit the function if preparation fails
				end
			end

			-- Send the appropriate notice
			if isRegistered == false then
				ao.send({
					Target = msg.From,
					Action = "Register-Notice",
				})
			end
		end
	)

	Handlers.add(
		camel(ActionMap.AccessControlList),
		Handlers.utils.hasMatchingTag("Action", ActionMap.AccessControlList),
		function(msg)
			local address = msg.Tags["Address"]
			assert(address, "Address is required")

			-- Query for ant_ids based on owner and controllers
			local stmt = ANT_DB_ADMIN.db:prepare([[
                SELECT DISTINCT ant_index.ant_id FROM ant_index 
                LEFT JOIN ant_controllers ON ant_index.ant_id = ant_controllers.ant_id
                WHERE ant_index.owner = ? OR ant_controllers.controller = ?
            ]])

			if not stmt then
				print("SQL Error (AccessControlList preparation): " .. ANT_DB_ADMIN.db:errmsg())
			end

			local antIds = {}

			if stmt then
				stmt:bind_values(address, address)
				for row in stmt:nrows() do
					table.insert(antIds, row.ant_id)
				end
				stmt:finalize()
			else
				ao.send({
					Target = msg.From,
					Action = "Access-Control-List-Failure",
					["Message-Id"] = msg.Id,
					Data = "Failed to prepare SQL statement",
				})
				return -- Exit the function if preparation fails
			end

			-- Send the list of ant_ids as a JSON array
			ao.send({
				Target = msg.From,
				Action = "Access-Control-List-Notice",
				["Message-Id"] = msg.Id,
				Data = json.encode(antIds),
			})
		end
	)

	Handlers.add(
		camel(ActionMap.GetAllAnts),
		Handlers.utils.hasMatchingTag("Action", ActionMap.GetAllAnts),
		function(msg)
			-- Query to get all ant_ids and owners
			local stmt = ANT_DB_ADMIN.db:prepare("SELECT ant_id, owner FROM ant_index")

			if not stmt then
				print("SQL Error (GetAllAnts preparation): " .. ANT_DB_ADMIN.db:errmsg())
			end

			local ants = {}

			if stmt then
				for row in stmt:nrows() do
					table.insert(ants, { ant_id = row.ant_id, owner = row.owner })
				end
				stmt:finalize()
			else
				ao.send({
					Target = msg.From,
					Action = "Get-All-Ants-Failure",
					["Message-Id"] = msg.Id,
					Data = "Failed to prepare SQL statement",
				})
				return -- Exit the function if preparation fails
			end

			-- Send the list of ants as a JSON array
			ao.send({
				Target = msg.From,
				Action = "Get-All-Ants-Notice",
				["Message-Id"] = msg.Id,
				Data = json.encode(ants),
			})
		end
	)
end

return main
