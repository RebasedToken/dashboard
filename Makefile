BRANCH=$(shell git symbolic-ref --short HEAD)
ENV?=development

www:
	@python2 -m SimpleHTTPServer 8000

deploy:
ifeq ($(BRANCH), master)
	@surge -d https://rebased-token-dashboard.surge.sh -p .
else
	@surge -d https://rebased-token-dashboard-$(BRANCH).surge.sh -p .
endif

pm2:
	@./node_modules/.bin/pm2 start ecosystem.config.js --env $(ENV)

.PHONY: \
	deploy \
	www \
	pm2