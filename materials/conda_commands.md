# Conda Commands Reference

## Quick notes

- These examples assume conda is installed (Miniconda/Anaconda). On Linux prefer Miniconda for small installs.
- Replace placeholders like <env>, <pkg>, <file> with your values.
- If you use mamba (drop-in faster replacement), swap `conda` with `mamba` in most commands.

---

## Conda install / update

Install Miniconda (Linux example):
```bash
# download and run installer interactively
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh
```

Update conda itself:
```bash
conda update conda
# or prefer strict channel priorities and safety:
conda update -n base -c defaults conda
```

Check conda version:
```bash
conda --version
```

Use mamba (faster solver) after installing it:
```bash
conda install -n base -c conda-forge mamba
mamba --version
```

---

## Creating, listing, and removing environments

Create an environment with a specific Python version:
```bash
conda create -n <env> python=3.10
```

Create an env and install packages at the same time:
```bash
conda create -n data-science python=3.10 numpy pandas scikit-learn -c conda-forge
```

List environments:
```bash
conda env list
# or
conda info --envs
```

Activate / deactivate environment:
```bash
conda activate <env>
conda deactivate
```

Remove (delete) an environment:
```bash
conda remove -n <env> --all
```

Rename environment (copy & remove method):
```bash
conda create -n <new-env> --clone <old-env>
conda remove -n <old-env> --all
```

---

## Installing, updating, and removing packages

Install a package into the active environment:
```bash
conda install <pkg>
# prefer conda-forge channel for many community packages:
conda install -c conda-forge <pkg>
```

Install a specific version:
```bash
conda install <pkg>=1.2.3
```

Update a package:
```bash
conda update <pkg>
```

Update all packages in the environment (may be slow):
```bash
conda update --all
```

Remove a package:
```bash
conda remove <pkg>
```

List packages in current env:
```bash
conda list
```

Search for packages available from channels:
```bash
conda search <pkg>
# include a channel
conda search -c conda-forge <pkg>
```

---

## Channels and priorities

Add a channel for installs (channel is a package source):
```bash
conda config --add channels conda-forge
```

Set channel priority (strict is recommended):
```bash
conda config --set channel_priority strict
```

View current channel config:
```bash
conda config --show channels
```

Temporarily install from a channel without adding it permanently:
```bash
conda install -c conda-forge <pkg>
```

---

## Exporting and sharing environments

Export environment to YAML (portable, recommended):
```bash
conda env export --name <env> --file environment.yml --no-builds
```

Create env from YAML:
```bash
conda env create -f environment.yml
```

Export only explicit package list (exact packages and channels):
```bash
conda list --explicit > spec-file.txt
```

Create env from explicit spec:
```bash
conda create --name <env> --file spec-file.txt
```

Note: YAML is best for sharing; explicit specs are for reproducing exact binaries.

---

## Using pip inside conda envs

Prefer conda packages when available; otherwise use pip after activating the env:
```bash
conda activate <env>
pip install <package>
```

To export pip-installed packages along with conda packages, include pip section in YAML
or run `pip freeze` and track separately.

---

## Troubleshooting dependency resolution

If conda's solver struggles or is slow:
- Try `mamba install <pkg>` (mamba is a faster replacement).
- Add channels in the recommended order (defaults, then conda-forge) and set strict priority.

If environment creation fails due to conflicts:
- Try relaxing version pins or create a fresh env with only Python + critical packages and add others iteratively.
- Use `conda create --strict-channel-priority -n <env> ...` or use mamba.

Clear conda package cache (safe but disk I/O will redownload packages later):
```bash
conda clean --all
```

Show detailed solver/debug output (long):
```bash
CONDA_VERBOSITY=3 conda create -n debug-env python=3.10
```

---

## Working with environments in CI or headless systems

Create env without prompts (useful for scripts/CI):
```bash
conda create -y -n <env> python=3.10
```

Export minimal environment for CI caching using explicit specs:
```bash
conda list --explicit > spec-file.txt
```

Use micromamba for very small, fast bootstrap in CI:
```bash
# install micromamba (example)
curl -L https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xvj bin/micromamba
./bin/micromamba create -n env -y python=3.10 -c conda-forge
```

---

## Conda configuration and info

Show conda configuration and active env info:
```bash
conda info
conda config --show
```

Show channel sources and config locations:
```bash
conda config --show-sources
```

---

## Useful tips & best practices

- Prefer `conda env export --no-builds` for shareable environment files.
- Use `mamba` for faster installs and solving.
- Keep the base environment minimal; create named envs per project.
- Pin versions in `environment.yml` if you need reproducibility, but avoid overconstraining.
- Use `conda clean --tarballs --packages` periodically to reclaim disk space.

---

## Quick reference (common commands)

- Create env: `conda create -n <env> python=3.10`
- Activate: `conda activate <env>`
- Install pkg: `conda install <pkg>` or `mamba install <pkg>`
- List packages: `conda list`
- Export env: `conda env export -f environment.yml --no-builds`
- Remove env: `conda remove -n <env> --all`

---

If you want, I can:
- expand any section into step-by-step tutorials
- add examples for data science, ML, or C/C++ compiled packages
- convert the file to include common `mamba` examples and CI snippets

