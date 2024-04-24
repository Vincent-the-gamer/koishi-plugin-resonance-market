import { Context, Schema, segment, version } from 'koishi'
import axios from "axios"
import dayjs from "dayjs"
import { } from 'koishi-plugin-puppeteer'
import { Page } from "puppeteer-core";
import { resolve } from 'path';

export const name = 'resonance-market'
export const inject = ["puppeteer"]

const { version: pluginVersion } = require('../package.json')

export interface Config {
  imageMode: boolean
}

export const Config: Schema<Config> = Schema.object({
  imageMode: Schema.boolean().default(true).description('是否使用图片模式 (需要 puppeteer 服务)。')
})

// 时间格式
const timePattern = "YYYY-MM-DD HH:mm:ss"

// 趋势值映射
const trendMap = {
  "up": "涨",
  "same": "平",
  "down": "跌"
}

// 交易类型映射
const exchangeTypeMap = {
  "buy": "购买",
  "sell": "卖出"
}

export function apply(ctx: Context) {
  ctx.command("雷索纳斯市场 <item: text>")
    .alias("倒货")
    .action(async ({ session }, item) => {
      const res: any = await axios.get("https://resonance.breadio.wiki/api/product")
      const { latest } = res.data
      let items = latest.filter(i => i.name === item)
      if (items.length > 0) {
        if (ctx.config.imageMode && ctx.puppeteer) {
          let page: Page
          items = items.map(i => {
            return {
              id: i.id,
              name: i.name,
              percent: i.percent,
              price: i.price,
              trend: trendMap[i.trend],
              type: exchangeTypeMap[i.type],
              sourceCity: i.sourceCity,
              targetCity: i.targetCity,
              uploadedAt: dayjs(i.uploadedAt).format(timePattern)
            }
          })


          try {
            page = await ctx.puppeteer.page();
            await page.setViewport({ width: 1920 * 2, height: 1200 * 2 });
            await page.goto(`file:///${resolve(__dirname, "./page.html")}`)
            await page.waitForNetworkIdle();
            await page.evaluate(`renderData(${JSON.stringify(items)},"${version}","${pluginVersion}")`);
            const element = await page.$("html");
            return (
              segment.image(await element.screenshot({
                encoding: "binary"
              }), "image/png")
            );
          } catch (e) {
            session.send("图片渲染失败" + e)
          } finally {
            page?.close();
          }
        } else {
          items = items.map(i =>
            `ID: ${i.id}
      商品名称：${i.name}
      百分比：${i.percent}
      价格: ${i.price}
      趋势: ${trendMap[i.trend]}
      交易类型: ${exchangeTypeMap[i.type]}
      起始城市: ${i.sourceCity}
      目标城市: ${i.targetCity}
      最后上传时间: ${dayjs(i.uploadedAt).format(timePattern)}
      \r\n`
          )
          session.send(items)
        }
      } else {
        session.send("未查询到结果")
      }
    })
}
