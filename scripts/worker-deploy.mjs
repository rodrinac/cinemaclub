import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

// Matches the `worker` crate in worker/Cargo.toml. Workers Builds runs this
// script as its only command and does not run wrangler's custom build.
export const WORKER_BUILD_VERSION = "0.9.0";

export function repoRoot() {
  return fileURLToPath(new URL("..", import.meta.url));
}

function resolveCommand(command, env) {
  const pathValue = env.PATH ?? "";
  for (const dir of pathValue.split(delimiter).filter(Boolean)) {
    const candidate = join(dir, command);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function opensslReady(env) {
  const pkgConfig = resolveCommand("pkg-config", env);
  if (!pkgConfig) return false;
  try {
    execFileSync(pkgConfig, ["--exists", "openssl"], {
      env,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function wasmTargetReady(env) {
  const rustc = resolveCommand("rustc", env);
  if (!rustc) return false;
  try {
    execFileSync(
      rustc,
      ["--print", "target-libdir", "--target", "wasm32-unknown-unknown"],
      { env, stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

function workerBuildVersion(env, run) {
  const bin = resolveCommand("worker-build", env);
  if (!bin) return null;
  try {
    const out = run(bin, ["--version"], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return String(out).trim();
  } catch {
    return null;
  }
}

function hasRequiredWorkerBuild(env, run) {
  return workerBuildVersion(env, run) === WORKER_BUILD_VERSION;
}

function aptInstall(packages, run) {
  const args = ["install", "-y", "--no-install-recommends", ...packages];
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    run("apt-get", ["update"], { stdio: "inherit" });
    run("apt-get", args, { stdio: "inherit" });
  } else {
    run("sudo", ["apt-get", "update"], { stdio: "inherit" });
    run("sudo", ["apt-get", ...args], { stdio: "inherit" });
  }
}

export function ensureWorkerBuild({ env, run = execFileSync }) {
  const cargoBin = env.HOME ? join(env.HOME, ".cargo/bin") : null;
  let next = { ...env };
  if (hasRequiredWorkerBuild(next, run)) return next;
  if (cargoBin && existsSync(join(cargoBin, "worker-build"))) {
    next = { ...next, PATH: `${cargoBin}${delimiter}${next.PATH ?? ""}` };
    if (hasRequiredWorkerBuild(next, run)) return next;
  }
  if (!env.HOME) {
    throw new Error("HOME is required to install the Rust wasm toolchain.");
  }
  if (!resolveCommand("cargo", next)) {
    run(
      "bash",
      [
        "-c",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --target wasm32-unknown-unknown",
      ],
      { env: next, stdio: "inherit" },
    );
    next = { ...next, PATH: `${cargoBin}${delimiter}${next.PATH ?? ""}` };
  } else if (!wasmTargetReady(next)) {
    if (!resolveCommand("rustup", next)) {
      throw new Error(
        "rustc is missing the wasm32-unknown-unknown target and rustup is not installed.",
      );
    }
    run("rustup", ["target", "add", "wasm32-unknown-unknown"], {
      env: next,
      stdio: "inherit",
    });
  }
  if (!hasRequiredWorkerBuild(next, run)) {
    if (!opensslReady(next) && resolveCommand("apt-get", next)) {
      aptInstall(["pkg-config", "libssl-dev"], run);
    }
    run(
      "cargo",
      [
        "install",
        "worker-build",
        "--version",
        WORKER_BUILD_VERSION,
        "--locked",
        "--force",
      ],
      { env: next, stdio: "inherit" },
    );
    next = { ...next, PATH: `${cargoBin}${delimiter}${next.PATH ?? ""}` };
  }
  if (!hasRequiredWorkerBuild(next, run)) {
    throw new Error(
      `worker-build ${WORKER_BUILD_VERSION} is not on PATH after installation.`,
    );
  }
  return next;
}

export async function deploy({
  wranglerArgs = [],
  env = process.env,
  run = execFileSync,
  prepareToolchain = ensureWorkerBuild,
  root = repoRoot(),
} = {}) {
  let next = {
    ...env,
    PATH: `${join(root, "node_modules/.bin")}${delimiter}${env.PATH ?? ""}`,
    WRANGLER_SEND_METRICS: env.WRANGLER_SEND_METRICS ?? "false",
  };
  next = prepareToolchain({ env: next, run });
  run("worker-build", ["--release"], {
    cwd: join(root, "worker"),
    env: next,
    stdio: "inherit",
  });
  run("wrangler", ["deploy", ...wranglerArgs], {
    cwd: join(root, "worker"),
    env: { ...next, CINEMACLUB_SKIP_WORKER_BUILD: "1" },
    stdio: "inherit",
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deploy({ wranglerArgs: process.argv.slice(2) }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
