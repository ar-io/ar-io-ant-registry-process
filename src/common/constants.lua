local constants = {}

constants.ARWEAVE_ID_REGEXP = "^[a-zA-Z0-9-_]{43}$"
constants.INVALID_ARWEAVE_ID_MESSAGE = "Invalid Arweave ID"
constants.MAX_UNDERNAME_LENGTH = 61
constants.UNDERNAME_REGEXP = "^(?:@|[a-zA-Z0-9][a-zA-Z0-9-_]{0,"
	.. (constants.MAX_UNDERNAME_LENGTH - 2)
	.. "}[a-zA-Z0-9])$"
constants.MIN_TTL_SECONDS = 900
constants.MAX_TTL_SECONDS = 3600

return constants
