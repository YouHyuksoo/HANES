"""
@file setup.py
@description PyPI package configuration for cli-anything-hanes.
"""

from setuptools import setup, find_namespace_packages

setup(
    name="cli-anything-hanes",
    version="1.0.0",
    description="CLI harness for HANES MES — Wire Harness Manufacturing Execution System",
    long_description=open("cli_anything/hanes/README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="HANES MES Team",
    python_requires=">=3.10",
    packages=find_namespace_packages(include=["cli_anything.*"]),
    install_requires=[
        "click>=8.0.0",
        "prompt-toolkit>=3.0.0",
    ],
    entry_points={
        "console_scripts": [
            "cli-anything-hanes=cli_anything.hanes.hanes_cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Manufacturing",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
