# PEAN的开发小天地

Windows 桌面学习看板：打卡、火焰与奖章激励、学习路线与任务、心情日记、截图记录。
基于 Electron + 原生 HTML/CSS/JS，正在重构为 iOS 风格液态玻璃界面，并接入 AI 激励管理。

## 运行

```bash
npm install
npm start        # 启动软件
npm run lab      # 打开液态玻璃 / 动效原型实验室
npm run build    # 打包 Windows 安装程序
```

用户数据保存在本机 `%APPDATA%\learning-dashboard\data\`，不在仓库里。

## 版本记录

| 版本 | 内容 |
| --- | --- |
| v1.0.0 | 重构前快照 |
| v1.1.0 | 液态玻璃与动效原型：CSS/SVG 玻璃定稿，统一弹簧物理（跟手拖动、果冻回弹） |

重构路线：v1.2 数据层 → v1.3 新排版 → v1.4 玻璃接入 → v1.5 AI 基础 → v1.6 AI 审核打卡 → **v2.0.0-New liquid Pro**
