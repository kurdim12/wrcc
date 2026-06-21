"""Compact CNN for the 40×32 log-mel patch -> P(activity).

Kept small enough to later quantize to int8 for ESP32-S3 (esp-tflite-micro
stretch goal, §9.7). Host inference (v1) uses the float SavedModel.
"""
from __future__ import annotations

import tensorflow as tf
from tensorflow.keras import layers, models

from features.params import N_MELS, N_FRAMES


def build_model() -> tf.keras.Model:
    inp = layers.Input(shape=(N_MELS, N_FRAMES, 1), name="logmel")
    x = layers.Conv2D(16, 3, padding="same", activation="relu")(inp)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPool2D(2)(x)
    x = layers.Conv2D(32, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPool2D(2)(x)
    x = layers.Conv2D(64, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(32, activation="relu")(x)
    out = layers.Dense(1, activation="sigmoid", name="p_activity")(x)

    model = models.Model(inp, out, name="palmguard_cnn")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="binary_crossentropy",
        metrics=[tf.keras.metrics.AUC(name="roc_auc"),
                 tf.keras.metrics.AUC(name="pr_auc", curve="PR")],
    )
    return model
