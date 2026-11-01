// 把引号里的内容换成你们的信息即可。留空的内容会显示温柔的占位文案。
// 婚礼资料只在此文件维护，公开页面没有资料编辑或导出入口。
window.WEDDING_CONFIG = {
  groom: '新郎',
  bride: '新娘',
  date: '',             // 格式：2027-05-20
  time: '',             // 格式：16:00
  venue: '',
  address: '',
  mapUrl: '',           // 高德 / 腾讯地图的 https 分享链接，可留空
  groomPhone: '',
  bridePhone: '',
  fontData: '',          // 可填写字体 data URL
  fontName: '',
  schedule: ['15:30', '16:00', '17:00', '19:00'],
  photos: [
    '',                                      // 故事附图，暂不展示
    'assets/photos/classic-portrait.webp',    // 相册主图 · 双人全身照
    'assets/photos/riverside-embrace.webp',   // 相册 · 江畔相拥
    'assets/photos/city-stroll.webp',         // 相册 · 街头牵手
    'assets/photos/garden-promise.webp',      // 登岛 · 花园横图
    'assets/photos/bride-bouquet.webp',       // 广播 · 新娘竖照
    'assets/photos/veil-moment.webp',         // 仪式 · 头纱横图
    '',                                      // 日历附图，暂不展示
    '',                                      // 日程附图，暂不展示
    '',                                      // 地图附图，暂不展示
    'assets/photos/shared-smile.webp',        // 结尾 · 双人笑颜
    '',                                      // 结尾第二张，暂不展示
  ],
};
