# -*- coding: utf-8 -*-
import requests
import re
import os
import sys
import json

ORIGINAL_MAXUI_FONT_URL = 'font'
DEFAULT_MAXUI_FONTS_URL = '/maxui/font'
DEFAULT_MAXUI_FONTS_FOLDER = './maxui/font'
DEFAULT_MAXUI_GITHUB_URL = 'https://github.com/UPCnet/max.ui5.js'
DEFAULT_MAXUI_BRANCH = 'chatactivity'
DEFAULT_MAXUI_JS = './maxui.min.js'
DEFAULT_MAXUI_CSS = './maxui.css'


def saveConfiguration(config):
    """
        Loads stored configuration from .maxui_setup
    """
    dump = json.dumps(config, indent=4, sort_keys=True)
    with open('.maxui_setup', 'w') as f:
        f.write(dump)


def getConfiguration():
    """
        Gests current configuration stored on .maxui_setup
    """
    if not os.path.exists('.maxui_setup'):
        default = {
            'github_url': DEFAULT_MAXUI_GITHUB_URL,
            'branch': DEFAULT_MAXUI_BRANCH,
        }
        saveConfiguration(default)
    with open('.maxui_setup', 'r') as f:
        data = f.read()
    config = json.loads(data)
    return config


def downloadFile(config, filename, raw=True):
    """
        Downloads a file from the repo and branch specified in the configuration
        If raw is False, will download the github page html instead of the raw file
    """
    params = dict(config)
    params['filename'] = filename
    params['tree'] = 'raw' if raw else 'tree'
    url = f"{config['github_url']}/{params['tree']}/{config['branch']}/{filename}"
    sys.stdout.write(f" Downloading {url} ")
    sys.stdout.flush()
    response = requests.get(url, verify=False)
    if response.status_code != 200:
        return False
    sys.stdout.write("✓\n")
    sys.stdout.flush()
    return response.content


def main():
    print()
    config = getConfiguration()

    if 'fonts_url' not in config:
        fonts_url = input(
            f"Fonts base_url ['{DEFAULT_MAXUI_FONTS_URL}']: ").strip().rstrip('/')
        config['fonts_url'] = fonts_url if fonts_url else DEFAULT_MAXUI_FONTS_URL

    if 'fonts_location' not in config:
        fonts_location = input(
            f"Font files location ['{DEFAULT_MAXUI_FONTS_FOLDER}']: ").strip().rstrip(
            '/')
        config['fonts_location'] = fonts_location if fonts_location else DEFAULT_MAXUI_FONTS_FOLDER

    if 'js_location' not in config:
        js_location = input(
            f"Javascript file location ['{DEFAULT_MAXUI_JS}']: ").strip()
        config['js_location'] = js_location if js_location else DEFAULT_MAXUI_JS

    if 'css_location' not in config:
        css_location = input(
            f"Stylesheet file location ['{DEFAULT_MAXUI_CSS}']: ").strip()
        config['css_location'] = css_location if css_location else DEFAULT_MAXUI_CSS

    saveConfiguration(config)

    version = json.loads(downloadFile(
        config, 'package.json').decode('utf-8'))['version']

    js = downloadFile(config, f'builds/{version}/maxui.min.js')
    if not js:
        print(f' MAX UI Version {version} build not found')
        sys.exit(1)
    with open(config['js_location'], 'wb') as f:
        f.write(js)

    js_map = downloadFile(config, f'builds/{version}/maxui.min.js.map')
    if not js_map:
        print(f' MAX UI jsmap Version {version} build not found')
        sys.exit(1)
    fname = config['js_location'].rsplit('.js', 1)[0]
    with open(f'{fname}.map', 'wb') as f:
        f.write(js_map)

    js_source = downloadFile(config, f'builds/{version}/maxui.js')
    if not js_source:
        print(f' MAX UI js source Version {version} build not found')
        sys.exit(1)
    path = '/'.join(config['js_location'].split('/')[:-1])
    with open(f'{path}/maxui.js', 'wb') as f:
        f.write(js_source)

    css = downloadFile(config, f'builds/{version}/maxui.min.css').decode('utf-8')
    sys.stdout.write(" Modifying font links ")
    sys.stdout.flush()
    css = re.sub(
        rf"(url\(['\"]?){ORIGINAL_MAXUI_FONT_URL}(/maxicons['\"]?)",
        rf"\1{config['fonts_url']}\2",
        css
    )
    with open(config['css_location'], 'w') as f:
        f.write(css)
    sys.stdout.write("✓\n")
    sys.stdout.flush()

    extensions = ['eot', 'svg', 'ttf', 'woff']
    for extension in extensions:
        fontbytes = downloadFile(config, f'builds/{version}/font/maxicons.{extension}')
        with open(f"{config['fonts_location']}/maxicons.{extension}", 'wb') as f:
            f.write(fontbytes)

    print(f'\n MAX UI {version} setup finished\n')


if __name__ == "__main__":
    main()
