# rex-widgets

Rex 订阅, 只有两个模块:

1. **聚合实时榜单(原版)** - 聚合各平台实时榜单数据, 内置瓜子影视播放源。
2. **荐片兜底播放源(改版)** - 瓜子搜不到时, 按片名从荐片取线路, 仅精确匹配, 避免播错片。

## 订阅链接

```
https://raw.githubusercontent.com/steam-100/rex-widgets/main/widgets.fwd
```

## 文件

- `jianpian-fallback.js` - 兜底播放模块, 只有 loadResource, 不改动原版。
- `widgets.fwd` - 上面两个模块的订阅文件。

以后更新只改这个项目里的文件, Rex 刷新订阅就能拿到。
