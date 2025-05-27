local utils = require(".common.utils")

local ActionMap = {
	PatchState = "Patch-State",
}

utils.createActionHandler(ActionMap.PatchState, function(msg)
	-- TODO: enforce some type verification on the msg.Data
	local antId = msg.From
	local patchedState = msg.Data
	Send({
		device = "patch@1.0",
		cache = {
			[antId] = patchedState,
		},
	})
end)
