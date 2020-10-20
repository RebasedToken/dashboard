www:
	@python2 -m SimpleHTTPServer 8000

deploy:
	@surge -d https://rebased-token-dashboard.surge.sh -p .

.PHONY: \
	deploy \
	www