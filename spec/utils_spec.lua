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

	describe("utils.unregisterAnt", function()
		local ants, addresses, antId, antOwner, controller1, controller2

		before_each(function()
			-- Setup test data
			antId = "test-ant-id-123456789012345678901234567890123456789"
			antOwner = "test-owner-123456789012345678901234567890123456789"
			controller1 = "controller1-123456789012345678901234567890123456789"
			controller2 = "controller2-123456789012345678901234567890123456789"

			ants = {}
			ants[antId] = {
				Owner = antOwner,
				Controllers = {
					[controller1] = true,
					[controller2] = true,
				},
			}

			addresses = {}
			addresses[antOwner] = { [antId] = true }
			addresses[controller1] = { [antId] = true }
			addresses[controller2] = { [antId] = true }
		end)

		it("should successfully unregister ANT when called by owner", function()
			utils.unregisterAnt(antOwner, ants, antId, addresses)

			-- Verify ANT is removed from ants table
			assert.is_nil(ants[antId])

			-- Verify ANT is removed from all address affiliations
			assert.is_nil(addresses[antOwner][antId])
			assert.is_nil(addresses[controller1][antId])
			assert.is_nil(addresses[controller2][antId])
		end)

		it("should successfully unregister ANT when called by ANT itself", function()
			utils.unregisterAnt(antId, ants, antId, addresses)

			-- Verify ANT is removed from ants table
			assert.is_nil(ants[antId])

			-- Verify ANT is removed from all address affiliations
			assert.is_nil(addresses[antOwner][antId])
			assert.is_nil(addresses[controller1][antId])
			assert.is_nil(addresses[controller2][antId])
		end)

		it("should successfully unregister ANT when called by registry owner", function()
			-- Mock the Owner global variable
			_G.Owner = "registry-owner-123456789012345678901234567890123456789"

			utils.unregisterAnt(_G.Owner, ants, antId, addresses)

			-- Verify ANT is removed from ants table
			assert.is_nil(ants[antId])

			-- Verify ANT is removed from all address affiliations
			assert.is_nil(addresses[antOwner][antId])
			assert.is_nil(addresses[controller1][antId])
			assert.is_nil(addresses[controller2][antId])
		end)

		it("should successfully unregister ANT when called by registry itself (ao.id)", function()
			-- Mock the ao.id global variable
			_G.ao.id = "registry-ao-id-123456789012345678901234567890123456789"

			utils.unregisterAnt(_G.ao.id, ants, antId, addresses)

			-- Verify ANT is removed from ants table
			assert.is_nil(ants[antId])

			-- Verify ANT is removed from all address affiliations
			assert.is_nil(addresses[antOwner][antId])
			assert.is_nil(addresses[controller1][antId])
			assert.is_nil(addresses[controller2][antId])
		end)

		it("should throw error when antId is not a string", function()
			assert.has_error(function()
				utils.unregisterAnt(antOwner, ants, 123, addresses)
			end, "Process-Id is required")
		end)

		it("should throw error when ANT does not exist", function()
			local nonExistentAntId = "non-existent-ant-id-123456789012345678901234567890123456789"

			assert.has_error(function()
				utils.unregisterAnt(antOwner, ants, nonExistentAntId, addresses)
			end, "ANT " .. nonExistentAntId .. " does not exist")
		end)

		it("should throw error when called by unauthorized user", function()
			local unauthorizedUser = "unauthorized-user-123456789012345678901234567890123456789"

			assert.has_error(function()
				utils.unregisterAnt(unauthorizedUser, ants, antId, addresses)
			end, "Only ANT owner, ANT, or registry owner, or ao.id can unregister")
		end)

		it("should throw error when called by controller (not owner)", function()
			assert.has_error(function()
				utils.unregisterAnt(controller1, ants, antId, addresses)
			end, "Only ANT owner, ANT, or registry owner, or ao.id can unregister")
		end)

		it("should handle ANT with no controllers", function()
			-- Create ANT with no controllers
			ants[antId] = {
				Owner = antOwner,
				Controllers = {},
			}

			utils.unregisterAnt(antOwner, ants, antId, addresses)

			-- Verify ANT is removed from ants table
			assert.is_nil(ants[antId])

			-- Verify ANT is removed from owner's affiliations
			assert.is_nil(addresses[antOwner][antId])
		end)

		it("should handle ANT with only owner (no controllers)", function()
			-- Create ANT with only owner, no controllers
			ants[antId] = {
				Owner = antOwner,
				Controllers = {},
			}

			utils.unregisterAnt(antOwner, ants, antId, addresses)

			-- Verify ANT is removed from ants table
			assert.is_nil(ants[antId])

			-- Verify ANT is removed from owner's affiliations
			assert.is_nil(addresses[antOwner][antId])
		end)
	end)
end)
