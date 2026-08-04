# This docker is to build the android app
#
# docker-compose up --build
# docker exec -it <container_id> bash

FROM eclipse-temurin:17-jdk

RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    curl \
    git \
    python3 \
    make \
    clang \
    libssl-dev \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

ENV ANDROID_SDK_ROOT /opt/android-sdk
ENV PATH ${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools

RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools \
    && cd ${ANDROID_SDK_ROOT}/cmdline-tools \
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-8512546_latest.zip -O commandlinetools.zip \
    && unzip -q commandlinetools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools \
    && mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest \
    && rm commandlinetools.zip

RUN yes | sdkmanager --licenses \
    && sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

RUN curl -fsSL https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1

WORKDIR /app
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json

WORKDIR /install
RUN ln -s /app/package.json /install/package.json
RUN ln -s /app/package-lock.json /install/package-lock.json
RUN npm install

ENV NODE_PATH=/install/node_modules

WORKDIR /app