#!/usr/bin/env python3
"""正确的 FP16 转换"""
import onnx
from onnxconverter_common import float16

SRC = "/home/suchang/sanghuang-detector/model/model.onnx"
DST = "/home/suchang/sanghuang-detector/model/model_fp16.onnx"

print("加载 FP32 模型...")
model = onnx.load(SRC)

print("转换为 FP16（保留 I/O 为 float32）...")
model_fp16 = float16.convert_float_to_float16(   # ← 函数名改这里
    model,
    keep_io_types=True,
    disable_shape_infer=False,
    op_block_list=['Resize', 'ScatterND']
)

onnx.save(model_fp16, DST)
print(f"✅ 已保存: {DST}")

# 验证加载
import onnxruntime as ort
sess = ort.InferenceSession(DST, providers=['CPUExecutionProvider'])
print("✅ FP16 模型加载成功")

# 查看文件大小
import os
size_mb = os.path.getsize(DST) / (1024 * 1024)
print(f"📦 文件大小: {size_mb:.2f} MB")
