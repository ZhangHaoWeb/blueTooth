// index.js
// 获取应用实例
const app = getApp()
const Buffer = require('buffer/').Buffer
const PrinterJobs=require('../../printer/printerjobs')
const printerUtil = require('../../printer/printerutil')

Page({
    data: {
        motto: '蓝牙打印机demo',
        userInfo: {},
        hasUserInfo: false,
        canIUse: wx.canIUse('button.open-type.getUserInfo'),
        canIUseGetUserProfile: false,
        canIUseOpenData: wx.canIUse('open-data.type.userAvatarUrl') && wx.canIUse('open-data.type.userNickName'), // 如需尝试获取用户信息可改为false
        // 设备信息
        deviceId: 0,
        serviceId: 0,
        characteristicId: 0
    },
    onLoad() {
        if (wx.getUserProfile) {
            this.setData({
                canIUseGetUserProfile: true
            })
        }
        let buffer = this.getBuffer();
        console.log(buffer)
    },
    getUserProfile(e) {
        // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
        wx.getUserProfile({
            desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
            success: (res) => {
                console.log(res)
                this.setData({
                    userInfo: res.userInfo,
                    hasUserInfo: true
                })
            }
        })
    },
    getUserInfo(e) {
        // 不推荐使用getUserInfo获取用户信息，预计自2021年4月13日起，getUserInfo将不再弹出弹窗，并直接返回匿名的用户个人信息
        console.log(e)
        this.setData({
            userInfo: e.detail.userInfo,
            hasUserInfo: true
        })
    },
    // 初始化蓝牙
    bluetoothHandler() {
        wx.openBluetoothAdapter({
            success: (res) => {
                console.log('初始化蓝牙成功', res)
                this.startBluetoothDevicesDiscovery()
            },
            fail: (res) => {
                console.log('蓝牙不可用，请打开蓝牙设备')
                if (res.errCode === 10001) {
                    // 监听蓝牙设备状态值改变
                    wx.onBluetoothAdapterStateChange(function (res) {
                        console.log('蓝牙状态改变', res)
                        if (res.available) {
                            this.startBluetoothDevicesDiscovery()
                        }
                    })
                }
            }
        })
    },
    // 开始搜索设备
    startBluetoothDevicesDiscovery() {
        wx.startBluetoothDevicesDiscovery({
            allowDuplicatesKey: false,
            success: (res) => {
                console.log('开始搜索蓝牙设备成功', res)
                this.onBluetoothDeviceFound()
            },
        })
    },
    // 监听搜索到的设备信息
    onBluetoothDeviceFound() {
        wx.onBluetoothDeviceFound((res) => {
            // 打印机name ZTO688_5119
            if (res.devices[0].name == 'ZTO688_5119') {
                this.setData({
                    deviceId: res.devices[0].deviceId
                })
                this.createBLEConnection()
            }
        })
    },
    // 蓝牙连接设备
    createBLEConnection(e) {
        wx.createBLEConnection({
            deviceId: this.data.deviceId,
            success: (res) => {
                this.getBLEDeviceServices(this.data.deviceId)
            },
            fail(err) {
                console.log('蓝牙连接失败:', err)
            }
        })
        this.stopBluetoothDevicesDiscovery()
    },
    // 获取deviceId对应服务信息
    getBLEDeviceServices() {
        wx.getBLEDeviceServices({
            deviceId: this.data.deviceId,
            success: (res) => {
                console.log(res.services)

                // 判断是否主服务 isPrimary
                for (let i = 0; i < res.services.length; i++) {
                    if (res.services[i].isPrimary) {
                        this.getBLEDeviceCharacteristics(this.data.deviceId, res.services[i].uuid)
                        return
                    }
                }
            }
        })
    },
    // 获取服务特征值
    getBLEDeviceCharacteristics(deviceId, serviceId) {
        wx.getBLEDeviceCharacteristics({
            deviceId,
            serviceId,
            success: (res) => {
                console.log(res.characteristics)

                for (let i = 0; i < res.characteristics.length; i++) {
                    let item = res.characteristics[i]
                    if (item.properties.write) {
                        this.setData({
                            serviceId: serviceId,
                            characteristicId: item.uuid
                        })
                        return
                    }
                }
            },
            fail(res) {
                console.error('getBLEDeviceCharacteristics', res)
            }
        })
    },
    // 写数据
    writeBLECharacteristicValue() {
        console.log(this.data.deviceId, this.data.serviceId, this.data.characteristicId)
        let buffer = this.getBuffer();
        
        wx.writeBLECharacteristicValue({
            deviceId: this.data.deviceId,
            serviceId: this.data.serviceId,
            characteristicId: this.data.characteristicId,
            value: buffer,
            success(res) {
                console.log('数据写入成功 ', res.errMsg)
            },
            fail(err) {
                console.log('数据写书失败 ', err)
            },
            complete(info) {
                console.log(info)
            }
        })
    },
    // 停止发现设备
    stopBluetoothDevicesDiscovery() {
        wx.stopBluetoothDevicesDiscovery()
    },
    // 断开蓝眼连接
    closeBLEConnection() {
        wx.closeBLEConnection({
            deviceId: this.data.deviceId
        })
    },
    // 关闭蓝眼设备
    closeBluetoothAdapter() {
        wx.closeBluetoothAdapter()
        this._discoveryStarted = false
    },
    getBuffer() {
        let printerJobs = new PrinterJobs();
        printerJobs
        .print()
        .setAlign('LT')
        .print(printerUtil.fillLine())
        .setAlign('ct')
        .print('回单联')
        .setAlign('LT')
        .setLineSpacing(40)
        .print(printerUtil.inline(`车牌号:xxxx`, `区域:xxxx`))
        .print(printerUtil.inline(`快递线路:xxx`,`会员ID:xxx`))
        .print(printerUtil.inline(`寄件人:xxx`, `电话:xxx`))

        let buffer = printerJobs.buffer();

        return buffer;
    }
})