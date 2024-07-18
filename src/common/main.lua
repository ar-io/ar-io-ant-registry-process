local json = require(".common.json")
local main = {}

main.init = function()
	Owner = Owner or ao.env.Process.Owner
	Name = Name or "INSERT_NAME_HERE"

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
