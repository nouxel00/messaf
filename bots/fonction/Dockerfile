# Bot de fonction de MESSAF. Compilé par GitHub Actions (.github/workflows/bot-fonction.yml) et publié
# sur ghcr.io : la compilation de matrix-rust-sdk demande environ 3 Go de mémoire et un quart d'heure.
FROM rust:1.97.0-slim-trixie AS construction
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake clang pkg-config \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:trixie-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10002 --no-create-home bot \
    && mkdir /donnees && chown bot /donnees
COPY --from=construction /src/target/release/messaf-bot-fonction /usr/local/bin/messaf-bot-fonction
USER bot
# Magasin chiffré des clés du bot : à conserver (volume), sinon le bot perd l'accès aux anciens messages
VOLUME /donnees
EXPOSE 8090
CMD ["messaf-bot-fonction"]
