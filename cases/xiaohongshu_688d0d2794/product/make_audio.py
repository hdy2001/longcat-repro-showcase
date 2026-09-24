#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成30s空灵氛围音景 (程序化合成, 无版权问题)"""
import numpy as np
import subprocess, os

SR = 44100
DUR = 30.0
N = int(SR * DUR)
t = np.arange(N) / SR

rng = np.random.default_rng(7)

# Am9 氛围和弦: A2 E3 B3 C4 G4 (空灵开阔)
freqs = [110.00, 164.81, 246.94, 261.63, 392.00]
audio = np.zeros(N)

for i, f in enumerate(freqs):
    # 每个音: 基频 + 轻微失谐泛音, 慢速颤音
    detune = 1.0 + rng.uniform(-0.0015, 0.0015)
    lfo_f = 0.05 + 0.03 * i          # 不同声部不同呼吸速率
    lfo_ph = rng.uniform(0, 6.28)
    trem = 0.55 + 0.45 * np.sin(2 * np.pi * lfo_f * t + lfo_ph)
    trem = trem ** 1.5
    # 声部淡入淡出错开, 形成缓慢演变
    env = np.clip(np.sin(np.pi * np.clip((t - i * 1.2) / (DUR - i * 1.2), 0, 1)), 0, 1) ** 0.7
    ph = 2 * np.pi * f * detune * t + 0.3 * np.sin(2 * np.pi * 0.11 * t + i)
    voice = np.sin(ph) + 0.35 * np.sin(2 * ph + 0.2) + 0.12 * np.sin(3 * ph)
    audio += voice * trem * env * (0.16 / (1 + i * 0.25))

# 空气感: 滤波噪声缓慢起伏 (简单起见用调幅白噪声近似)
noise = rng.standard_normal(N)
# 简易低通: 滑动平均
k = 96
noise_lp = np.convolve(noise, np.ones(k) / k, mode="same")
noise_env = (0.5 + 0.5 * np.sin(2 * np.pi * 0.045 * t + 1.0)) ** 2
audio += noise_lp * noise_env * 0.05

# 开场/结尾整体淡入淡出
fade = np.clip(t / 2.5, 0, 1) * np.clip((DUR - t) / 2.0, 0, 1)
audio *= fade

# 归一化
audio = audio / (np.abs(audio).max() + 1e-9) * 0.85

# 立体声: 轻微去相关
delay = int(0.012 * SR)
right = np.roll(audio, delay) * 0.9 + audio * 0.1
stereo = np.stack([audio, right], axis=1)

pcm = (stereo * 32767).astype(np.int16)
raw = pcm.tobytes()

subprocess.run(["ffmpeg", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
                "-c:a", "aac", "-b:a", "192k", "ambient.m4a"],
               input=raw, check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("saved ambient.m4a")
