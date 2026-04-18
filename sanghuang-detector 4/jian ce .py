#!/usr/bin/env python3
"""对比 FP32 / FP16 / INT8 三个模型的推理结果"""
import onnxruntime as ort
import numpy as np
import cv2
import time
import os

MODELS = {
    "FP32": "/home/suchang/sanghuang-detector/model/model.onnx",
    # "FP16": "/home/suchang/sanghuang-detector/model/model_fp16.onnx",  # 暂时禁用，类型错误
    # "INT8": "/home/suchang/sanghuang-detector/model/model_int8.onnx",  # 暂时禁用
}
TEST_IMG = "/home/suchang/yolov5-7.0/runs/test/exp/ch01_20250822091238_timingCap.jpg"  # 改成你的测试图
IMGSZ = 640

# 预处理
img0 = cv2.imread(TEST_IMG)
img = cv2.resize(img0, (IMGSZ, IMGSZ))
img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).transpose(2, 0, 1)
img = np.ascontiguousarray(img, dtype=np.float32) / 255.0
img = img[None]  # (1,3,640,640)

results = {}
for name, path in MODELS.items():
    if not os.path.exists(path):
        continue
    sess = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
    input_name = sess.get_inputs()[0].name

    # 预热
    for _ in range(3):
        sess.run(None, {input_name: img})

    # 计时
    t0 = time.time()
    for _ in range(10):
        out = sess.run(None, {input_name: img})
    dt = (time.time() - t0) / 10 * 1000

    # 统计有效检测框（conf > 0.25）
    pred = out[0][0]            # (25200, 6+nc) for YOLOv5
    
    # 对置信度应用 sigmoid 激活
    def sigmoid(x):
        return 1 / (1 + np.exp(-x))
    
    conf = sigmoid(pred[:, 4])
    n_valid = (conf > 0.25).sum()
    max_conf = conf.max()

    results[name] = (dt, n_valid, max_conf)
    print(f"{name:5s}  推理 {dt:6.1f} ms | 有效框 {n_valid:4d} | 最高置信度 {max_conf:.4f}")

# 对比
if "FP32" in results and "INT8" in results:
    base = results["FP32"][2]
    for name, (_, _, c) in results.items():
        diff = abs(c - base) / base * 100
        print(f"{name} 置信度偏差: {diff:.2f}%")
