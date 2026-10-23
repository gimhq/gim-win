# Linux gate for gim-win: Rust stable with the Tauri 2 prerequisites, Node 22
# and Bun. Built by scripts/gate.sh as ai-agent/gim-win-gate.
FROM rust:1
LABEL ai-agent=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libwebkit2gtk-4.1-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        libssl-dev \
        build-essential \
        curl \
        wget \
        file \
        xdg-utils \
        pkg-config \
        unzip \
        ca-certificates \
        git \
    && rm -rf /var/lib/apt/lists/*

RUN rustup component add rustfmt clippy

# Node 22 LTS from NodeSource.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Bun into /usr/local/bin so it is on PATH for any user.
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash \
    && bun --version
