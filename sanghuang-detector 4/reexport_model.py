#!/usr/bin/env python3
"""
桑黄检测模型重新导出脚本
从训练好的 PyTorch 模型重新导出为优化的 ONNX 模型
"""

import torch
import sys
import os

def export_to_onnx():
    """
    从训练好的 PyTorch 模型导出优化的 ONNX 模型
    """
    print("=== 桑黄检测模型重新导出 ===\n")
    
    # 模型路径
    best_pt = "/home/suchang/runs/detect/runs/train/v26_cbam_001/weights/best.pt"
    output_onnx = "/home/suchang/sanghuang-detector/model/model.onnx"
    
    # 检查模型是否存在
    if not os.path.exists(best_pt):
        print(f"错误: 找不到训练好的模型 {best_pt}")
        return
    
    print(f"加载模型: {best_pt}")
    print(f"模型大小: {os.path.getsize(best_pt) / (1024*1024):.2f} MB")
    
    try:
        # 加载模型
        model = torch.hub.load('ultralytics/yolov5', 'custom', path=best_pt)
        model.eval()
        
        print("模型加载成功")
        
        # 导出为 ONNX
        print("正在导出为 ONNX 格式...")
        
        # 设置导出参数
        img_size = 640  # 输入图像大小
        
        # 创建虚拟输入
        dummy_input = torch.randn(1, 3, img_size, img_size)
        
        # 导出模型
        torch.onnx.export(
            model,
            dummy_input,
            output_onnx,
            export_params=True,
            opset_version=12,  # 使用较新的opset版本
            do_constant_folding=True,  # 常量折叠优化
            input_names=['images'],
            output_names=['output'],
            dynamic_axes={
                'images': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )
        
        print(f"ONNX 模型导出成功: {output_onnx}")
        print(f"模型大小: {os.path.getsize(output_onnx) / (1024*1024):.2f} MB")
        
        # 验证模型
        print("正在验证模型...")
        import onnx
        onnx_model = onnx.load(output_onnx)
        onnx.checker.check_model(onnx_model)
        print("模型验证通过")
        
    except Exception as e:
        print(f"导出失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    export_to_onnx()