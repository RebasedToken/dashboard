branch=$(shell git symbolic-ref --short HEAD)

www:
	@python2 -m SimpleHTTPServer 8000

deploy:
ifeq ($(branch), master)
	@surge -d https://rebased-token-dashboard.surge.sh -p .
else
	@surge -d https://rebased-token-dashboard-$(branch).surge.sh -p .
endif

.PHONY: \
	deploy \
	www