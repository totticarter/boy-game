Page({
  data: {
    gameMode: 'single',
    score: 0,
    score2: 0,
    length: 3,
    length2: 3,
    timeLeft: 120,
    timerText: '2:00',
    gameStarted: false,
    gameRunning: false,
    gamePaused: false,
    showGameOver: false,
    controlText: '使用下方按钮控制',
    winnerText: '',
    winnerColor: '#4CAF50',
    finalScoreText: '',
    finalLengthText: '',
    speedLevel: 3 // 默认速度档位为3（中速）
  },

  // 游戏常量
  GRID_SIZE: 20,
  TILE_COUNT: 10, // 从30改为10，格子变大3倍
  baseSpeed: 400, // 基准速度（档位3）
  speedLevels: [
    667, // 档位1：最慢（400 * 1.67）
    533, // 档位2：较慢（400 * 1.33）
    400, // 档位3：中速（基准速度）
    333, // 档位4：较快（400 / 1.2）
    267  // 档位5：最快（400 / 1.5）
  ],
  gameSpeed: 400, // 当前游戏速度

  // 游戏状态
  ctx: null,
  snake: [],
  snake2: [],
  direction: { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },
  direction2: { x: -1, y: 0 },
  nextDirection2: { x: -1, y: 0 },
  smallFood: null,
  bigFood: null,
  purpleFood: null, // 紫色果实
  wall: [], // 墙壁数组
  lastUpdateTime: 0,
  timerInterval: null,
  gameLoopInterval: null,
  blinkingSegments: null, // 闪烁的蛇身段
  blinkCount: 0, // 闪烁计数
  isBlinking: false, // 是否正在闪烁
  snakeHeadType: 'rect', // 蛇1头部类型: 'rect'=方形, 'circle'=圆形(小果实), 'bigCircle'=大圆形(大果实), 'star'=星形(紫色果实)
  snakeHeadType2: 'rect', // 蛇2头部类型

  onLoad(options) {
    const mode = options.mode || 'single'
    const controlText = mode === 'single' 
      ? '使用下方按钮控制蛇的移动' 
      : '玩家1使用左侧按钮，玩家2使用右侧按钮'
    
    this.setData({ 
      gameMode: mode,
      controlText
    })
  },

  onReady() {
    // 在 onReady 中初始化 Canvas，确保页面渲染完成
    wx.nextTick(() => {
      this.initCanvas()
    })
  },

  initCanvas() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res && res[0] && res[0].node) {
          const canvas = res[0].node
          this.ctx = canvas.getContext('2d')
          
          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = 700 * dpr
          canvas.height = 700 * dpr
          this.ctx.scale(dpr, dpr)

          console.log('Canvas 初始化成功')
          this.initGame()
        } else {
          console.error('Canvas 节点获取失败，请检查 Canvas 组件是否正确配置')
          // 如果失败，延迟重试
          setTimeout(() => {
            this.initCanvas()
          }, 500)
        }
      })
  },

  onUnload() {
    this.stopGame()
  },

  initGame() {
    // 初始化蛇1（调整位置适应10x10的网格）
    this.snake = [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ]
    this.direction = { x: 1, y: 0 }
    this.nextDirection = { x: 1, y: 0 }
    this.snakeHeadType = 'rect' // 重置蛇头类型为方形

    // 初始化蛇2
    if (this.data.gameMode === 'double') {
      this.snake2 = [
        { x: 7, y: 7 },
        { x: 8, y: 7 },
        { x: 9, y: 7 }
      ]
      this.direction2 = { x: -1, y: 0 }
      this.nextDirection2 = { x: -1, y: 0 }
      this.snakeHeadType2 = 'rect' // 重置蛇2头部类型为方形
    }

    // 移除墙壁
    this.wall = []

    // 初始化食物
    this.smallFood = this.spawnFood()
    this.bigFood = this.spawnFood()
    
    // 单人模式才生成紫色果实
    if (this.data.gameMode === 'single') {
      this.purpleFood = this.spawnPurpleFood()
    } else {
      this.purpleFood = null
    }

    this.setData({
      score: 0,
      score2: 0,
      length: 3,
      length2: 3,
      timeLeft: 120,
      timerText: '2:00'
    })

    this.draw()
  },

  randomPosition() {
    return {
      x: Math.floor(Math.random() * this.TILE_COUNT),
      y: Math.floor(Math.random() * this.TILE_COUNT)
    }
  },

  spawnFood() {
    let position
    do {
      position = this.randomPosition()
    } while (
      this.snake.some(segment => segment.x === position.x && segment.y === position.y) ||
      (this.data.gameMode === 'double' && this.snake2.some(segment => segment.x === position.x && segment.y === position.y)) ||
      this.wall.some(block => block.x === position.x && block.y === position.y) || // 避免生成在墙上
      (this.smallFood && position.x === this.smallFood.x && position.y === this.smallFood.y) || // 避免与小食物重叠
      (this.bigFood && position.x === this.bigFood.x && position.y === this.bigFood.y) || // 避免与大食物重叠
      (this.purpleFood && position.x === this.purpleFood.x && position.y === this.purpleFood.y) // 避免与紫色果实重叠
    )
    return position
  },

  // 生成紫色果实（只在四个角落）
  spawnPurpleFood() {
    const corners = [
      { x: 0, y: 0 }, // 左上
      { x: this.TILE_COUNT - 1, y: 0 }, // 右上
      { x: 0, y: this.TILE_COUNT - 1 }, // 左下
      { x: this.TILE_COUNT - 1, y: this.TILE_COUNT - 1 } // 右下
    ]
    
    // 过滤掉被蛇占据的角落
    const availableCorners = corners.filter(corner => {
      const onSnake1 = this.snake.some(segment => segment.x === corner.x && segment.y === corner.y)
      const onSnake2 = this.data.gameMode === 'double' && this.snake2.some(segment => segment.x === corner.x && segment.y === corner.y)
      return !onSnake1 && !onSnake2
    })
    
    // 如果没有可用的角落，返回null
    if (availableCorners.length === 0) {
      return null
    }
    
    // 随机选择一个可用的角落
    const randomCorner = availableCorners[Math.floor(Math.random() * availableCorners.length)]
    return randomCorner
  },

 drawRect(x, y, color, borderColor = null) {
    const size = 700 / this.TILE_COUNT
    const radius = size * 0.25 // 圆角半径为格子大小的25%
    
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.roundRect(x * size, y * size, size - 1, size - 1, radius)
    this.ctx.fill()
    
    if (borderColor) {
      this.ctx.strokeStyle = borderColor
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }
  },

  drawCircle(x, y, color) {
    const size = 700 / this.TILE_COUNT
    const radius = size * 0.25 // 使用圆角矩形代替圆形
    
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.roundRect(x * size, y * size, size - 1, size - 1, radius)
    this.ctx.fill()
  },

  // 绘制蛇身（支持闪烁效果）
  drawSnakeSegment(segment, index, snakeArray, isPlayer2 = false, shouldBlink = false) {
    const size = 700 / this.TILE_COUNT
    
    // 如果需要闪烁且当前是闪烁的"隐藏"状态，则不绘制
    if (shouldBlink && this.blinkCount % 2 === 1) {
      return
    }
    
    if (index === 0) {
      // 蛇头 - 根据头部类型绘制不同形状
      const headColor = isPlayer2 ? '#FF5722' : '#4CAF50'
      const headBorderColor = isPlayer2 ? '#D84315' : '#2E7D32'
      const headType = isPlayer2 ? this.snakeHeadType2 : this.snakeHeadType
      
      if (headType === 'rect') {
        // 方形蛇头（初始状态）
        this.drawRect(segment.x, segment.y, headColor, headBorderColor)
      } else if (headType === 'circle') {
        // 圆形蛇头（吃到小果实）
        this.drawCircle(segment.x, segment.y, headColor)
      } else if (headType === 'bigCircle') {
        // 大圆形蛇头（吃到大果实）
        this.drawCircle(segment.x, segment.y, headColor)
        // 内部小圆
        this.ctx.fillStyle = '#FFC107'
        this.ctx.beginPath()
        this.ctx.arc(segment.x * size + size / 2, segment.y * size + size / 2, size / 4, 0, Math.PI * 2)
        this.ctx.fill()
      } else if (headType === 'star') {
        // 星形蛇头（吃到紫色果实）
        this.drawCircle(segment.x, segment.y, '#9C27B0')
        // 内部小圆
        this.ctx.fillStyle = '#E1BEE7'
        this.ctx.beginPath()
        this.ctx.arc(segment.x * size + size / 2, segment.y * size + size / 2, size / 4, 0, Math.PI * 2)
        this.ctx.fill()
      }
      
      // 在蛇头上显示节数
      this.ctx.fillStyle = 'white'
      this.ctx.font = `bold ${Math.floor(size * 0.6)}px Arial`
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText(snakeArray.length, segment.x * size + size / 2, segment.y * size + size / 2)
    } else {
      // 蛇身 - 如果即将消失则显示黑色
      let bodyColor, bodyBorderColor
      if (shouldBlink) {
        bodyColor = '#333333'
        bodyBorderColor = '#000000'
      } else {
        // 蛇身纹理效果
        if (isPlayer2) {
          bodyColor = '#FF6B35' // 玩家2橙红色基调
          bodyBorderColor = '#D84315'
        } else {
          bodyColor = '#4CAF50' // 玩家1绿色基调
          bodyBorderColor = '#2E7D32'
        }
      }
      this.drawRect(segment.x, segment.y, bodyColor, bodyBorderColor)
      
      // 添加蛇皮纹理效果（斑点）
      if (!shouldBlink) {
        const size = 700 / this.TILE_COUNT
        this.ctx.fillStyle = isPlayer2 ? 'rgba(216, 67, 21, 0.3)' : 'rgba(46, 125, 50, 0.4)'
        // 绘制两个小斑点
        this.ctx.beginPath()
        this.ctx.arc(segment.x * size + size * 0.3, segment.y * size + size * 0.35, size * 0.12, 0, Math.PI * 2)
        this.ctx.fill()
        this.ctx.beginPath()
        this.ctx.arc(segment.x * size + size * 0.7, segment.y * size + size * 0.65, size * 0.1, 0, Math.PI * 2)
        this.ctx.fill()
      }
    }
  },

  draw() {
    if (!this.ctx) return

    const size = 700 / this.TILE_COUNT

    // 清空画布
    this.ctx.fillStyle = '#f0f0f0'
    this.ctx.fillRect(0, 0, 700, 700)

    // 画墙壁
    this.wall.forEach(block => {
      this.drawRect(block.x, block.y, '#666666', '#333333')
    })

    // 画蛇1
    this.snake.forEach((segment, index) => {
      const shouldBlink = this.isBlinking && this.blinkingSegments && 
                         this.blinkingSegments.player === 1 &&
                         index >= this.blinkingSegments.startIndex
      this.drawSnakeSegment(segment, index, this.snake, false, shouldBlink)
    })

    // 画蛇2
    if (this.data.gameMode === 'double') {
      this.snake2.forEach((segment, index) => {
        const shouldBlink = this.isBlinking && this.blinkingSegments && 
                           this.blinkingSegments.player === 2 &&
                           index >= this.blinkingSegments.startIndex
        this.drawSnakeSegment(segment, index, this.snake2, true, shouldBlink)
      })
    }

    // 画小食物
    this.drawCircle(this.smallFood.x, this.smallFood.y, '#4CAF50')

    // 画大食物
    this.drawCircle(this.bigFood.x, this.bigFood.y, '#FF5722')
    this.ctx.fillStyle = '#FFC107'
    this.ctx.beginPath()
    this.ctx.arc(
      this.bigFood.x * size + size / 2, 
      this.bigFood.y * size + size / 2, 
      size / 4, 
      0, 
      Math.PI * 2
    )
    this.ctx.fill()

    // 画紫色果实（单人模式）
    if (this.data.gameMode === 'single' && this.purpleFood) {
      this.drawCircle(this.purpleFood.x, this.purpleFood.y, '#9C27B0')
      // 紫色果实内部画个星星效果
      this.ctx.fillStyle = '#E1BEE7'
      this.ctx.beginPath()
      this.ctx.arc(
        this.purpleFood.x * size + size / 2, 
        this.purpleFood.y * size + size / 2, 
        size / 4, 
        0, 
        Math.PI * 2
      )
      this.ctx.fill()
    }
  },

  updateSnake(snakeArray, dir, nextDir, isPlayer2 = false) {
    // 确保蛇和方向都已初始化
    if (!snakeArray || snakeArray.length === 0 || !nextDir) {
      console.error('蛇或方向未初始化')
      return dir
    }

    let direction = { ...nextDir }
    let head = { 
      x: snakeArray[0].x + direction.x, 
      y: snakeArray[0].y + direction.y 
    }
    let needsRedirect = false

    // 检查边界碰撞
    if (head.x < 0 || head.x >= this.TILE_COUNT || head.y < 0 || head.y >= this.TILE_COUNT) {
      this.playHitWallSound()
      needsRedirect = true
      
      if (snakeArray.length > 3) {
        snakeArray.splice(snakeArray.length - 3, 3)
        this.updateLengthDisplay(isPlayer2)
      }
    }

    // 检查是否撞到墙壁
    const hitWall = this.wall.some(block => block.x === head.x && block.y === head.y)
    if (hitWall) {
      this.playHitWallSound()
      needsRedirect = true
      
      if (snakeArray.length > 3) {
        snakeArray.splice(snakeArray.length - 3, 3)
        this.updateLengthDisplay(isPlayer2)
      }
    }
    
    const hitOther = this.data.gameMode === 'double' ? 
      (isPlayer2 ? 
        this.snake.some(segment => segment.x === head.x && segment.y === head.y) :
        this.snake2.some(segment => segment.x === head.x && segment.y === head.y)) :
      false
    
    if (hitOther) {
      needsRedirect = true
    }

    // 自动转向
    if (needsRedirect) {
      const allDirections = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 }
      ]
      
      const validDirections = allDirections.filter(d => {
        const newX = snakeArray[0].x + d.x
        const newY = snakeArray[0].y + d.y
        
        if (newX < 0 || newX >= this.TILE_COUNT || newY < 0 || newY >= this.TILE_COUNT) {
          return false
        }
        
        if (snakeArray.some(seg => seg.x === newX && seg.y === newY)) {
          return false
        }
        
        // 检查是否碰到墙壁
        if (this.wall.some(block => block.x === newX && block.y === newY)) {
          return false
        }
        
        if (this.data.gameMode === 'double') {
          const otherSnake = isPlayer2 ? this.snake : this.snake2
          if (otherSnake.some(seg => seg.x === newX && seg.y === newY)) {
            return false
          }
        }
        
        return true
      })
      
      if (validDirections.length > 0) {
        const newDirection = validDirections[Math.floor(Math.random() * validDirections.length)]
        direction = { ...newDirection }
        if (isPlayer2) {
          this.nextDirection2 = { ...newDirection }
        } else {
          this.nextDirection = { ...newDirection }
        }
        head = { x: snakeArray[0].x + direction.x, y: snakeArray[0].y + direction.y }
      } else {
        return direction
      }
    }

    snakeArray.unshift(head)

    // 检查自身碰撞（在添加新头部后检查）
    const hitSelfIndex = snakeArray.findIndex((segment, index) => 
      index > 1 && segment.x === head.x && segment.y === head.y
    )
    if (hitSelfIndex > 1) {
      // 触发闪烁效果，但不阻止移动
      this.triggerBlinkEffect(snakeArray, hitSelfIndex, isPlayer2)
    }

    // 检查食物
    if (head.x === this.smallFood.x && head.y === this.smallFood.y) {
      this.playEatSmallSound()
      if (isPlayer2) {
        this.setData({ score2: this.data.score2 + 10 })
        this.snakeHeadType2 = 'circle' // 蛇头变成圆形
      } else {
        this.setData({ score: this.data.score + 10 })
        this.snakeHeadType = 'circle' // 蛇头变成圆形
      }
      this.smallFood = this.spawnFood()
    } else if (head.x === this.bigFood.x && head.y === this.bigFood.y) {
      this.playEatBigSound()
      if (isPlayer2) {
        this.setData({ score2: this.data.score2 + 20 })
        this.snakeHeadType2 = 'bigCircle' // 蛇头变成大圆形
      } else {
        this.setData({ score: this.data.score + 20 })
        this.snakeHeadType = 'bigCircle' // 蛇头变成大圆形
      }
      snakeArray.push({ ...snakeArray[snakeArray.length - 1] })
      this.bigFood = this.spawnFood()
    } else if (this.data.gameMode === 'single' && this.purpleFood && 
               head.x === this.purpleFood.x && head.y === this.purpleFood.y) {
      // 吃到紫色果实（单人模式）
      this.playEatBigSound()
      wx.vibrateShort({ type: 'heavy' })
      this.setData({ score: this.data.score + 30 })
      this.snakeHeadType = 'star' // 蛇头变成星形
      // 增加3节
      snakeArray.push({ ...snakeArray[snakeArray.length - 1] })
      snakeArray.push({ ...snakeArray[snakeArray.length - 1] })
      snakeArray.push({ ...snakeArray[snakeArray.length - 1] })
      this.purpleFood = this.spawnPurpleFood()
    } else {
      snakeArray.pop()
    }

    this.updateLengthDisplay(isPlayer2)
    
    // 检查是否达到胜利条件（单人模式，长度达到总格子数的一半）
    if (this.data.gameMode === 'single' && !isPlayer2) {
      const totalTiles = this.TILE_COUNT * this.TILE_COUNT // 10x10=100
      const winLength = Math.floor(totalTiles / 2) // 50
      if (snakeArray.length >= winLength) {
        this.endGameByVictory()
        return direction
      }
    }
    
    return direction
  },

  // 触发闪烁效果
  triggerBlinkEffect(snakeArray, startIndex, isPlayer2) {
    if (this.isBlinking) return // 如果已经在闪烁中，忽略
    
    this.isBlinking = true
    this.blinkCount = 0
    this.blinkingSegments = {
      player: isPlayer2 ? 2 : 1,
      startIndex: startIndex,
      snakeArray: snakeArray
    }
    
    // 播放音效和震动
    this.playHitWallSound()
    wx.vibrateShort({ type: 'medium' })
    
    // 闪烁动画（每100ms切换一次，共闪烁1次=2次切换）
    const blinkInterval = setInterval(() => {
      this.blinkCount++
      
      if (this.blinkCount >= 2) { // 闪烁1次（显示-隐藏）
        clearInterval(blinkInterval)
        
        // 移除撞击部位到尾部的所有部分
        snakeArray.splice(startIndex)
        this.updateLengthDisplay(isPlayer2)
        
        // 重置闪烁状态
        this.isBlinking = false
        this.blinkCount = 0
        this.blinkingSegments = null
      }
    }, 100) // 每100ms切换一次显示/隐藏状态
  },

  updateLengthDisplay(isPlayer2) {
    if (isPlayer2) {
      this.setData({ length2: this.snake2.length })
    } else {
      this.setData({ length: this.snake.length })
    }
  },

  update() {
    if (!this.data.gameRunning || this.data.gamePaused) return
    
    // 确保游戏数据已初始化
    if (!this.snake || !this.direction || !this.nextDirection) {
      console.error('游戏数据未初始化')
      return
    }
    
    this.direction = this.updateSnake(this.snake, this.direction, this.nextDirection, false)
    if (this.data.gameMode === 'double') {
      if (this.snake2 && this.direction2 && this.nextDirection2) {
        this.direction2 = this.updateSnake(this.snake2, this.direction2, this.nextDirection2, true)
      }
    }
    
    this.draw()
  },

  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
    }
    
    this.timerInterval = setInterval(() => {
      if (!this.data.gamePaused && this.data.gameRunning) {
        const timeLeft = this.data.timeLeft - 1
        const minutes = Math.floor(timeLeft / 60)
        const seconds = timeLeft % 60
        const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`
        
        this.setData({ timeLeft, timerText })
        
        if (timeLeft <= 0) {
          this.endGameByTime()
        }
      }
    }, 1000)
  },

  startGame() {
    if (this.data.gameStarted && this.data.gameRunning) return
    
    // 确保游戏已经初始化
    if (!this.snake || this.snake.length === 0 || !this.smallFood || !this.bigFood) {
      console.error('游戏未初始化，无法开始')
      wx.showToast({
        title: '游戏加载中...',
        icon: 'none'
      })
      return
    }
    
    if (!this.data.gameStarted) {
      this.playStartSound()
      this.setData({
        gameStarted: true,
        gameRunning: true,
        gamePaused: false
      })
      
      this.startTimer()
      this.lastUpdateTime = Date.now()
      
      // 开始游戏循环
      this.updateGameSpeed()
      this.gameLoopInterval = setInterval(() => {
        this.update()
      }, this.gameSpeed)
    }
  },

  // 更新游戏速度
  updateGameSpeed() {
    const level = this.data.speedLevel - 1
    this.gameSpeed = this.speedLevels[level]
  },

  // 切换速度档位
  changeSpeed(e) {
    if (this.data.gameRunning) {
      wx.showToast({
        title: '游戏进行中无法调速',
        icon: 'none'
      })
      return
    }
    
    const level = parseInt(e.currentTarget.dataset.level)
    this.setData({ speedLevel: level })
    this.updateGameSpeed()
    wx.vibrateShort({ type: 'light' })
  },

  togglePause() {
    if (!this.data.gameStarted || !this.data.gameRunning) return
    
    const gamePaused = !this.data.gamePaused
    this.setData({ gamePaused })
    this.playPauseSound()
  },

  restartGame() {
    this.stopGame()
    this.setData({
      gameStarted: false,
      gameRunning: false,
      gamePaused: false,
      showGameOver: false
    })
    this.updateGameSpeed() // 更新速度
    this.initGame()
  },

  stopGame() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval)
      this.gameLoopInterval = null
    }
  },

  endGameByTime() {
    this.playTimeUpSound()
    this.stopGame()
    
    let winnerText = ''
    let winnerColor = '#4CAF50'
    let finalScoreText = ''
    let finalLengthText = ''
    
    if (this.data.gameMode === 'single') {
      // 单人模式：检查是否达到胜利条件
      const totalTiles = this.TILE_COUNT * this.TILE_COUNT
      const winLength = Math.floor(totalTiles / 2)
      
      if (this.data.length >= winLength) {
        winnerText = '🎉 胜利! 🎉'
        winnerColor = '#4CAF50'
        this.playWinSound()
      } else {
        winnerText = '⏰ 时间到! 再接再厉!'
        winnerColor = '#FFC107'
      }
      
      finalScoreText = `最终分数: ${this.data.score}`
      finalLengthText = `最终长度: ${this.data.length} / ${winLength} (胜利条件)`
      
      // 保存最高分
      const highScore = wx.getStorageSync('highScore') || 0
      if (this.data.score > highScore) {
        wx.setStorageSync('highScore', this.data.score)
      }
    } else {
      if (this.data.score > this.data.score2) {
        winnerText = '🎉 玩家1获胜! 🎉'
        winnerColor = '#4CAF50'
        this.playWinSound()
      } else if (this.data.score2 > this.data.score) {
        winnerText = '🎉 玩家2获胜! 🎉'
        winnerColor = '#FF5722'
        this.playWinSound()
      } else {
        winnerText = '🤝 平局! 🤝'
        winnerColor = '#FFC107'
      }
      finalScoreText = `玩家1分数: ${this.data.score} | 玩家2分数: ${this.data.score2}`
      finalLengthText = `玩家1长度: ${this.data.length} | 玩家2长度: ${this.data.length2}`
    }
    
    this.setData({
      gameRunning: false,
      showGameOver: true,
      winnerText,
      winnerColor,
      finalScoreText,
      finalLengthText
    })
  },

  // 碰撞自己尾巴游戏结束
  endGameByCollision(player) {
    this.playHitWallSound()
    this.stopGame()
    
    let winnerText = '💥 撞到自己尾巴！游戏结束!'
    let winnerColor = '#ff6b6b'
    let finalScoreText = ''
    let finalLengthText = ''
    
    if (this.data.gameMode === 'single') {
      const totalTiles = this.TILE_COUNT * this.TILE_COUNT
      const winLength = Math.floor(totalTiles / 2)
      finalScoreText = `最终分数: ${this.data.score}`
      finalLengthText = `最终长度: ${this.data.length} / ${winLength} (胜利条件)`
    } else {
      winnerText = player === 'player1' ? '💥 玩家1撞到自己!' : '💥 玩家2撞到自己!'
      finalScoreText = `玩家1分数: ${this.data.score} | 玩家2分数: ${this.data.score2}`
      finalLengthText = `玩家1长度: ${this.data.length} | 玩家2长度: ${this.data.length2}`
    }
    
    this.setData({
      gameRunning: false,
      showGameOver: true,
      winnerText,
      winnerColor,
      finalScoreText,
      finalLengthText
    })
  },

  // 达到胜利条件
  endGameByVictory() {
    this.playWinSound()
    wx.vibrateShort({ type: 'heavy' })
    this.stopGame()
    
    const totalTiles = this.TILE_COUNT * this.TILE_COUNT
    const winLength = Math.floor(totalTiles / 2)
    
    this.setData({
      gameRunning: false,
      showGameOver: true,
      winnerText: '🏆 大胜利! 🏆',
      winnerColor: '#FFD700',
      finalScoreText: `最终分数: ${this.data.score}`,
      finalLengthText: `最终长度: ${this.data.length} / ${winLength} (已达成!)`
    })
    
    // 保存最高分
    const highScore = wx.getStorageSync('highScore') || 0
    if (this.data.score > highScore) {
      wx.setStorageSync('highScore', this.data.score)
    }
  },

  hideGameOver() {
    this.setData({ showGameOver: false })
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  backToHome() {
    wx.navigateBack()
  },

  // 玩家1控制
  player1Up() {
    if (this.direction.y === 0) {
      this.nextDirection = { x: 0, y: -1 }
    }
  },

  player1Down() {
    if (this.direction.y === 0) {
      this.nextDirection = { x: 0, y: 1 }
    }
  },

  player1Left() {
    if (this.direction.x === 0) {
      this.nextDirection = { x: -1, y: 0 }
    }
  },

  player1Right() {
    if (this.direction.x === 0) {
      this.nextDirection = { x: 1, y: 0 }
    }
  },

  // 玩家2控制
  player2Up() {
    if (this.direction2.y === 0) {
      this.nextDirection2 = { x: 0, y: -1 }
    }
  },

  player2Down() {
    if (this.direction2.y === 0) {
      this.nextDirection2 = { x: 0, y: 1 }
    }
  },

  player2Left() {
    if (this.direction2.x === 0) {
      this.nextDirection2 = { x: -1, y: 0 }
    }
  },

  player2Right() {
    if (this.direction2.x === 0) {
      this.nextDirection2 = { x: 1, y: 0 }
    }
  },

  // 音效函数
  playSound(frequency, duration) {
    // 微信小程序的音效需要使用 InnerAudioContext
    // 这里简化处理，可以后续添加音频文件
  },

  playEatSmallSound() {
    wx.vibrateShort({ type: 'light' })
  },

  playEatBigSound() {
    wx.vibrateShort({ type: 'medium' })
  },

  playHitWallSound() {
    wx.vibrateShort({ type: 'heavy' })
  },

  playStartSound() {
    wx.vibrateShort({ type: 'light' })
  },

  playPauseSound() {
    wx.vibrateShort({ type: 'light' })
  },

  playWinSound() {
    wx.vibrateShort({ type: 'medium' })
  },

  playTimeUpSound() {
    wx.vibrateShort({ type: 'heavy' })
  }
})
