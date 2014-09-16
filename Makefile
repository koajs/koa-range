
include node_modules/make-lint/index.mk

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--require should \
		--harmony-generators \
		test/* \
		--bail

test-cov:
	@NODE_ENV=test node --harmony-generators \
		./node_modules/.bin/istanbul cover \
		./node_modules/.bin/_mocha \
		-- -u exports \
		--require should \
		test/* \
		--bail

.PHONY: test test-cov
