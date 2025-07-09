package.path = "spec/?.lua;spec/?/init.lua;" .. package.path

_G.ao = {
	send = function(val)
		return val
	end,
	id = "test",
	env = {
		Process = {
			Id = "test",
			Owner = "test",
		},
	},
}

_G.Handlers = {
	utils = {
		reply = function()
			return true
		end,
	},
}

-- Global variables needed for utils functions
_G.ADDRESSES = {}
_G.ANTS = {}
_G.Owner = "test-owner-123456789012345678901234567890123456789"

print("Setup global ao mocks successfully...")
