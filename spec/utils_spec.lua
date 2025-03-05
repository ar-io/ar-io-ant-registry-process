-- spec/utils_spec.lua
local utils = require(".common.utils")

describe("utils.lua", function()
	describe("utils.validateArweaveId", function()
		it("should throw an error for invalid Arweave IDs", function()
			local invalid = utils.validateArweaveId("invalid-arweave-id-123")
			assert.is_false(invalid)
		end)

		it("should not throw an error for a valid Arweave ID", function()
			local valid = utils.validateArweaveId("0E7Ai_rEQ326_vLtgB81XHViFsLlcwQNqlT9ap24uQI")
			assert.is_true(valid)
		end)
	end)
end)
