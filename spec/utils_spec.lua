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
			end, "Unable to unregister ANT " .. nonExistentAntId .. " because it does not exist")
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

	describe("utils.patchAffiliationsForAnt", function()
		local ants, antId, antOwner, controller1, controller2

		before_each(function()
			-- Setup test data
			antId = "test-ant-id-123456789012345678901234567890123456789"
			antOwner = "test-owner-123456789012345678901234567890123456789"
			controller1 = "controller1-123456789012345678901234567890123456789"
			controller2 = "controller2-123456789012345678901234567890123456789"

			ants = {}

			-- Reset global tables
			_G.ANTS = {}
			_G.ADDRESSES = {}
		end)

		it("should remove ANT from all affiliations", function()
			-- Create ANT with multiple controllers
			ants[antId] = {
				Owner = antOwner,
				Controllers = {
					[controller1] = true,
					[controller2] = true,
				},
			}

			-- Add other ANTs to make the test more realistic
			local otherAntId1 = "other-ant-1-123456789012345678901234567890123456789"
			local otherAntId2 = "other-ant-2-123456789012345678901234567890123456789"

			ants[otherAntId1] = {
				Owner = controller1,
				Controllers = { [antOwner] = true },
			}

			ants[otherAntId2] = {
				Owner = antOwner,
				Controllers = { [controller2] = true },
			}

			-- Set up global tables to match local test data
			_G.ANTS = ants
			_G.ADDRESSES[antOwner] = { [antId] = true, [otherAntId2] = true }
			_G.ADDRESSES[controller1] = { [antId] = true }
			_G.ADDRESSES[controller2] = { [antId] = true, [otherAntId2] = true }
			_G.ADDRESSES[otherAntId1] = {}

			local result = utils.patchAffiliationsForAnt(antId, ants)

			-- Verify the result structure
			assert.is_not_nil(result)
			assert.is_not_nil(result[antOwner])
			assert.is_not_nil(result[controller1])
			assert.is_not_nil(result[controller2])

			-- Verify the target ANT is removed from owner's owned list
			local ownerOwned = result[antOwner].Owned
			for _, ownedAnt in ipairs(ownerOwned) do
				assert.is_not_equal(ownedAnt, antId, "ANT should be removed from owner's owned list")
			end

			-- Verify the target ANT is removed from controller1's controlled list
			local controller1Controlled = result[controller1].Controlled
			for _, controlledAnt in ipairs(controller1Controlled) do
				assert.is_not_equal(controlledAnt, antId, "ANT should be removed from controller1's controlled list")
			end

			-- Verify the target ANT is removed from controller2's controlled list
			local controller2Controlled = result[controller2].Controlled
			for _, controlledAnt in ipairs(controller2Controlled) do
				assert.is_not_equal(controlledAnt, antId, "ANT should be removed from controller2's controlled list")
			end

			-- Verify other ANTs are still present
			assert.is_true(
				utils.includes(otherAntId1, result[controller1].Owned),
				"Other ANT should still be owned by controller1"
			)
			assert.is_true(
				utils.includes(otherAntId2, result[antOwner].Owned),
				"Other ANT should still be owned by owner"
			)
			assert.is_true(
				utils.includes(otherAntId1, result[antOwner].Controlled),
				"Other ANT should still be controlled by owner"
			)
			assert.is_true(
				utils.includes(otherAntId2, result[controller2].Controlled),
				"Other ANT should still be controlled by controller2"
			)
		end)

		it("should handle ANT with single controller", function()
			-- Create ANT with single controller
			ants[antId] = {
				Owner = antOwner,
				Controllers = {
					[controller1] = true,
				},
			}

			-- Add another ANT owned by the controller
			local otherAntId = "other-ant-123456789012345678901234567890123456789"
			ants[otherAntId] = {
				Owner = controller1,
				Controllers = {},
			}

			-- Set up global tables to match local test data
			_G.ANTS = ants
			_G.ADDRESSES[antOwner] = { [antId] = true }
			_G.ADDRESSES[controller1] = { [antId] = true, [otherAntId] = true }

			local result = utils.patchAffiliationsForAnt(antId, ants)

			-- Verify the result structure
			assert.is_not_nil(result)
			assert.is_not_nil(result[antOwner])
			assert.is_not_nil(result[controller1])

			-- Verify the target ANT is removed from owner's owned list
			local ownerOwned = result[antOwner].Owned
			for _, ownedAnt in ipairs(ownerOwned) do
				assert.is_not_equal(ownedAnt, antId, "ANT should be removed from owner's owned list")
			end

			-- Verify the target ANT is removed from controller's controlled list
			local controllerControlled = result[controller1].Controlled
			for _, controlledAnt in ipairs(controllerControlled) do
				assert.is_not_equal(controlledAnt, antId, "ANT should be removed from controller's controlled list")
			end

			-- Verify other ANT is still present
			assert.is_true(
				utils.includes(otherAntId, result[controller1].Owned),
				"Other ANT should still be owned by controller"
			)
		end)

		it("should handle ANT that appears in multiple affiliations", function()
			-- Create a complex scenario where the ANT appears in multiple affiliations
			ants[antId] = {
				Owner = antOwner,
				Controllers = {
					[controller1] = true,
					[controller2] = true,
				},
			}

			-- Create another ANT that is controlled by the target ANT's owner
			local otherAntId = "other-ant-123456789012345678901234567890123456789"
			ants[otherAntId] = {
				Owner = controller1,
				Controllers = { [antOwner] = true },
			}

			-- Set up global tables to match local test data
			_G.ANTS = ants
			_G.ADDRESSES[antOwner] = { [antId] = true }
			_G.ADDRESSES[controller1] = { [antId] = true, [otherAntId] = true }
			_G.ADDRESSES[controller2] = { [antId] = true }

			local result = utils.patchAffiliationsForAnt(antId, ants)

			-- Verify the target ANT is completely removed from all affiliations
			for user, affiliations in pairs(result) do
				for _, ownedAnt in ipairs(affiliations.Owned) do
					assert.is_not_equal(ownedAnt, antId, "ANT should be removed from all owned lists")
				end
				for _, controlledAnt in ipairs(affiliations.Controlled) do
					assert.is_not_equal(controlledAnt, antId, "ANT should be removed from all controlled lists")
				end
			end

			-- Verify other ANTs are still present
			assert.is_true(
				utils.includes(otherAntId, result[controller1].Owned),
				"Other ANT should still be owned by controller1"
			)
			assert.is_true(
				utils.includes(otherAntId, result[antOwner].Controlled),
				"Other ANT should still be controlled by owner"
			)
		end)

		it("should handle empty ants table", function()
			-- Create ANT in empty table
			ants[antId] = {
				Owner = antOwner,
				Controllers = { [controller1] = true },
			}

			-- Set up global tables to match local test data
			_G.ANTS = ants
			_G.ADDRESSES[antOwner] = { [antId] = true }
			_G.ADDRESSES[controller1] = { [antId] = true }

			local result = utils.patchAffiliationsForAnt(antId, ants)

			-- Verify the result structure
			assert.is_not_nil(result)
			assert.is_not_nil(result[antOwner])
			assert.is_not_nil(result[controller1])

			-- Verify the target ANT is removed from all affiliations
			assert.is_true(#result[antOwner].Owned == 0, "Owner should have no owned ANTs after removal")
			assert.is_true(
				#result[controller1].Controlled == 0,
				"Controller should have no controlled ANTs after removal"
			)
		end)
	end)
end)
