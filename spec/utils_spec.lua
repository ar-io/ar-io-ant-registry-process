-- spec/utils_spec.lua
local utils = require(".common.utils")

describe("utils.lua", function()
	describe("utils.validateSemver", function()
		local validVersions = {
			"1.0.0",
			"0.1.0",
			"1.2.3",
			"10.20.30",
			"1.0.0-alpha",
			"1.0.0-beta.2",
			"9223372036854775807.0.0", -- Added to test large numbers
		}

		for _, version in ipairs(validVersions) do
			it(string.format("should accept valid version: %s", version), function()
				assert.has_no.errors(function()
					utils.validateSemver(version)
				end)
			end)
		end

		local invalidVersions = {
			["incomplete version string missing patch"] = "1.0",
			["incomplete version string missing minor and patch"] = "1",
			["too many version segments"] = "1.0.0.0",
			["contains invalid prefix"] = "v1.0.0",
			["build metadata not supported"] = "1.0.0+build",
			["invalid version format"] = "not.a.version",
			["empty string"] = "",
			["non-string input"] = 123,
			["nil input"] = nil,
		}

		for reason, version in pairs(invalidVersions) do
			it(string.format("should reject invalid version: %s (%s)", tostring(version), reason), function()
				assert.has.errors(function()
					utils.validateSemver(version)
				end)
			end)
		end
	end)
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
