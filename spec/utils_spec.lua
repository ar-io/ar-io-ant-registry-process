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

	describe("utils.affiliationsForAnt", function()
		-- Setup test data
		local antId = "test-ant-id-123456789012345678901234567890123456789"
		local antOwner = "test-owner-123456789012345678901234567890123456789"
		local controller1 = "controller1-123456789012345678901234567890123456789"

		local ants = {
			[antId] = {
				Owner = antOwner,
				Controllers = {
					[controller1] = true,
				},
			},
		}

		it("should return affiliations for ANT with single controller", function()
			-- Add another ANT owned by the controller
			local otherAntId = "other-ant-123456789012345678901234567890123456789"
			ants[otherAntId] = {
				Owner = controller1,
				Controllers = {},
			}

			local result = utils.affiliationsForAnt(antId, ants)

			-- Verify the result structure
			assert.is_not_nil(result)
			assert.is_not_nil(result[antOwner])
			assert.is_not_nil(result[controller1])

			-- Verify owner's affiliations
			assert.is_table(result[antOwner].Owned)
			assert.is_table(result[antOwner].Controlled)
			assert.is_true(#result[antOwner].Owned >= 1) -- Should include the test ANT

			-- Verify controller's affiliations
			assert.is_table(result[controller1].Owned)
			assert.is_table(result[controller1].Controlled)
			assert.is_true(#result[controller1].Owned >= 1) -- Should include otherAntId
		end)
	end)
end)
