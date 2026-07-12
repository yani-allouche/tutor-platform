.PHONY: install check video clean

install:
	python3 -m venv .venv
	.venv/bin/python -m pip install --upgrade pip
	.venv/bin/pip install -r requirements.txt

check:
	.venv/bin/python -m shorts_pipeline.cli doctor

video:
	.venv/bin/python -m shorts_pipeline.cli generate "$(TOPIC)"

clean:
	rm -rf output

