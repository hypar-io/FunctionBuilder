## How It Works
Hypar Function Builder works with several commands in the Hypar CLI to provide a live building and visualization environment for use when building your Hypar functions.

## Prerequisites
- The Hypar CLI contains commands for generating, running, and publishing your Hypar function.
  - `dotnet tool install -g hypar.cli`
- A Hypar function. Hypar functions can be created from the command line using `hypar new`. This extension works on any directory that contains a `hypar.json` file.

## To Use
- Run the `Hypar: Run` task. This will start the build watcher.
- Run the `Hypar: Preview` command. This will start the Hypar preview.

## Explanation
This extensions contributes three tasks to VS Code.
- `Hypar: Run` - Automatically rebuild and execute your function when the following occurs:
  - The `input.json` file is updated.
  - The function code is rebuilt.
- `Hypar: Init` - Generate Hypar input, output, and function code from your `hypar.json`.
- `Hypar: Publish` - Publish your function to Hypar.

This extension contributes one command to VS Code.
- `Hypar: Preview` - View the model created by your Hypar function.