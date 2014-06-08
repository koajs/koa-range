
include node_modules/make-lint/index.mk

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--require should \
		--harmony-generators \
		test/* \
		--bail

.PHONY: test