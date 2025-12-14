Page({
  data: {
    highScore: 0
  },

  onLoad() {
    // 加载最高分
    const highScore = wx.getStorageSync('highScore') || 0
    this.setData({ highScore })
  },

  selectSingleMode() {
    wx.navigateTo({
      url: '/pages/game/game?mode=single'
    })
  },

  selectDoubleMode() {
    wx.navigateTo({
      url: '/pages/game/game?mode=double'
    })
  }
})
