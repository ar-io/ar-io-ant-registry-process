--[[
https://github.com/twilson63/aos-packages/blob/main/packages/db-admin/src/main.lua
Thanks to the author (Tom Wilson) for the starting code snippet.
]]
local schemas = require(".common.db.schemas")

local dbAdmin = {}
dbAdmin.__index = dbAdmin

-- Function to create a new database explorer instance
function dbAdmin.new(db)
	local self = setmetatable({}, dbAdmin)
	self.db = db
	return self
end

-- Function to list all tables in the database
function dbAdmin:tables()
	local tables = {}
	for row in self.db:nrows("SELECT name FROM sqlite_master WHERE type='table';") do
		table.insert(tables, row.name)
	end
	return tables
end

-- Function to get the record count of a table
function dbAdmin:count(tableName)
	local count_query = string.format("SELECT COUNT(*) AS count FROM %s;", tableName)
	for row in self.db:nrows(count_query) do
		return row.count
	end
end

-- Function to execute a given SQL query
function dbAdmin:exec(sql)
	local results = {}
	for row in self.db:nrows(sql) do
		table.insert(results, row)
	end
	return results
end

function dbAdmin:init()
	local antStatus = self:exec(schemas.ant_index)
	local antErr = self.db:errmsg()
	if not antStatus then
		print("Failed to create ant_index table: " .. antErr)
	end
	local controllerStatus = self:exec(schemas.controllers_index)
	local controllerErr = self.db:errmsg()
	if not controllerStatus then
		print("Failed to create ant_controllers table: " .. controllerErr)
	end
end

function dbAdmin:register(antId, timestamp)
	-- Prepare the SQL statement with parameters to avoid SQL injection
	local stmt = self.db:prepare("INSERT INTO ant_index (ant_id, owner, registered_at) VALUES (?, ?, ?)")
	assert(stmt, "Failed to prepare insert statement: " .. self.db:errmsg())
	stmt:bind_values(antId, "unknown", timestamp)
	stmt.step(stmt)
	stmt:finalize()
end

function dbAdmin:unregister(antId)
	-- Delete all controllers for the specified antId
	local deleteControllersStmt = self.db:prepare("DELETE FROM ant_controllers WHERE ant_id = ?")
	assert(deleteControllersStmt, "Failed to prepare delete statement for controllers: " .. self.db:errmsg())
	deleteControllersStmt:bind_values(antId)
	deleteControllersStmt:step()
	deleteControllersStmt:finalize()

	-- Delete the owner for the specified antId
	local deleteOwnerStmt = self.db:prepare("DELETE FROM ant_index WHERE ant_id = ?")
	assert(deleteOwnerStmt, "Failed to prepare delete statement for owner: " .. self.db:errmsg())
	deleteOwnerStmt:bind_values(antId)
	deleteOwnerStmt:step()
	deleteOwnerStmt:finalize()
end

function dbAdmin:isRegistered(antId)
	local stmt = self.db:prepare("SELECT * FROM ant_index WHERE ant_id = ?")
	assert(stmt, "Failed to prepare select statement: " .. self.db:errmsg())
	stmt:bind_values(antId)
	local row = stmt:step(stmt)
	stmt:finalize()
	return row
end

function dbAdmin:updateACL(antId, state)
	-- Passing in state here allows us to have a simple interface elsewhere
	-- may add or extend tables here in the future using more parts of the state
	-- errors bubble up from here, should call with pcall
	self:updateAntIndex(antId, state.Owner)
	self:updateControllersIndex(antId, state.Controllers)
end

function dbAdmin:updateAntIndex(antId, owner)
	local stmt = self.db:prepare("UPDATE ant_index SET owner = ? WHERE ant_id = ?")
	assert(stmt, "Failed to prepare update statement: " .. self.db:errmsg())
	stmt:bind_values(owner, antId)
	stmt:step()
	stmt:finalize()
end

function dbAdmin:updateControllersIndex(antId, controllers)
	-- Note: this could probably be more effiecient but controllers are unlikely to be large
	-- Delete all existing controllers for the specified antId
	local deleteStmt = self.db:prepare("DELETE FROM ant_controllers WHERE ant_id = ?")
	assert(deleteStmt, "Failed to prepare delete statement: " .. self.db:errmsg())
	deleteStmt:bind_values(antId)
	deleteStmt:step()
	deleteStmt:finalize()

	-- Insert each controller from the provided array into the database
	for _, controller in ipairs(controllers) do
		local insertStmt = self.db:prepare("INSERT OR IGNORE INTO ant_controllers (ant_id, controller) VALUES (?, ?)")
		assert(insertStmt, "Failed to prepare insert statement: " .. self.db:errmsg())
		insertStmt:bind_values(antId, controller)
		insertStmt:step()
		insertStmt:finalize()
	end
end

function dbAdmin:getAntsByAddress(address)
	local stmt = self.db:prepare([[
                SELECT DISTINCT ant_index.ant_id FROM ant_index 
                LEFT JOIN ant_controllers ON ant_index.ant_id = ant_controllers.ant_id
                WHERE ant_index.owner = ? OR ant_controllers.controller = ?
            ]])
	assert(stmt, "Failed to prepare ACL statement: " .. self.db:errmsg())
	stmt:bind_values(address, address)

	local antIds = {}
	for row in stmt:nrows() do
		table.insert(antIds, row.ant_id)
	end

	stmt:finalize()
	return antIds
end

function dbAdmin:beginTransaction()
	local stmt = self.db:prepare("BEGIN TRANSACTION")
	if stmt then
		stmt:step()
		stmt:finalize()
		return true
	else
		print("Failed to start transaction: " .. self.db:errmsg())
		return false
	end
end

function dbAdmin:commitTransaction()
	local stmt = self.db:prepare("COMMIT")
	if stmt then
		stmt:step()
		stmt:finalize()
		return true
	else
		print("Failed to commit transaction: " .. self.db:errmsg())
		return false
	end
end

function dbAdmin:rollbackTransaction()
	local stmt = self.db:prepare("ROLLBACK")
	if stmt then
		stmt:step()
		stmt:finalize()
		return true
	else
		print("Failed to roll back transaction: " .. self.db:errmsg())
		return false
	end
end

function dbAdmin:createSafeTransaction(func)
	return function(msg)
		local self = ANT_DB_ADMIN -- Accessing the global instance directly to bind the db instance
		if not self:beginTransaction() then
			return false, "Failed to start transaction"
		end

		local status, err = xpcall(function()
			return func(msg)
		end, debug.traceback)

		if not status then
			print("Error in transaction: " .. err)
			self:rollbackTransaction()
			return false, err
		end

		if not self:commitTransaction() then
			print("Failed to commit transaction: " .. self.db:errmsg())
			self:rollbackTransaction()
			return false, "Failed to commit transaction"
		end

		return true
	end
end

function dbAdmin:getAllAnts()
	local query = "SELECT ant_id, owner, registered_at FROM ant_index"
	local stmt = self.db:prepare(query)
	assert(stmt, "Failed to prepare query: " .. self.db:errmsg())

	local results = {}
	for row in stmt:nrows() do
		table.insert(results, row)
	end
	stmt:finalize()

	return results
end

--[[
	Future use: pagination, sorting, and filtering on reading the registry
]]
-- Function to get all ants with pagination, sorting, and filtering
-- function dbAdmin:getAnts(params)
-- 	local query = "SELECT ant_index.ant_id, ant_index.owner, ant_index.registered_at FROM ant_index"
-- 	local conditions = {}
-- 	local values = {}

-- 	-- Filtering
-- 	if params.owner then
-- 		table.insert(conditions, "ant_index.owner = ?")
-- 		table.insert(values, params.owner)
-- 	end

-- 	if params.controller then
-- 		query = query .. " JOIN ant_controllers ON ant_index.ant_id = ant_controllers.ant_id"
-- 		table.insert(conditions, "ant_controllers.controller = ?")
-- 		table.insert(values, params.controller)
-- 	end

-- 	if params.ant_id then
-- 		table.insert(conditions, "ant_index.ant_id = ?")
-- 		table.insert(values, params.ant_id)
-- 	end

-- 	if params.registered_at then
-- 		table.insert(conditions, "ant_index.registered_at = ?")
-- 		table.insert(values, params.registered_at)
-- 	end

-- 	if #conditions > 0 then
-- 		query = query .. " WHERE " .. table.concat(conditions, " AND ")
-- 	end

-- 	-- Sorting
-- 	if params.sort then
-- 		query = query .. " ORDER BY " .. params.sort
-- 		if params.order then
-- 			query = query .. " " .. params.order
-- 		end
-- 	end

-- 	-- Pagination
-- 	if params.limit then
-- 		query = query .. " LIMIT ?"
-- 		table.insert(values, params.limit)
-- 	end

-- 	if params.cursor then
-- 		query = query .. " OFFSET ?"
-- 		table.insert(values, params.cursor)
-- 	end

-- 	local stmt = self.db:prepare(query)
-- 	assert(stmt, "Failed to prepare query: " .. self.db:errmsg())

-- 	stmt:bind_values(table.unpack(values))

-- 	local results = {}
-- 	for row in stmt:nrows() do
-- 		table.insert(results, row)
-- 	end
-- 	stmt:finalize()

-- 	return results
-- end

return dbAdmin
