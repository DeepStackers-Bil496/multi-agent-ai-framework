const { spawn } = require("node:child_process");

const command = process.platform === "win32" ? "py" : "python3";
const child = spawn(command, ["services/tts_server.py"], {
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
