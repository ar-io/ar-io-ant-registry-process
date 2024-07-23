local json = require(".common.json")
local utils = require(".common.utils")
local main = {}

local camel = utils.camelCase
main.init = function()
	Owner = Owner or ao.env.Process.Owner
	Name = Name or "ar.io ANT Registry"

	local ActionMap = {
		Register = "Register",
		StateNotice = "State-Notice",
		AccessControlList = "Access-Control-List",
	}

	Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), function(msg)
		ao.send({
			Target = msg.From,
			Name = Name,
			Owner = Owner,
			Data = json.encode({
				Name = Name,
				Owner = Owner,
			}),
		})
	end)
end

return main
