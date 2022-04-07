const Koa = require('koa');
const Router = require('koa-router');;
const cors = require('koa2-cors');
const koaBody = require('koa-body');
const fs = require('fs');
const path = require('path');


const outputPath = path.resolve(__dirname, 'resource');
const app = new Koa();
let currentChunk = {};
const router = new Router();

// 处理跨域
app.use(cors({
  origin: (ctx) => {
    return '*'
  },
  maxAge: 5, //指定预检请求的有效期
  credentials: true, // 允许跨域携带cookie,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], //设置所允许的HTTP请求方法
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'], //设置服务器支持的所有头信息字段
  exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'] //设置获取其他自定义字段
}))

app.use(koaBody({}))

router.post('/upload',
  koaBody({
    multipart: true,
    formidable: {
      outputDie: outputPath,
      onFileBegin: (name, file) => {
        const [filename, fileHash, index] = name.split('-');
        const dir = path.join(outputPath, filename);
        currentChunk = {
          filename,
          fileHash,
          index
        }
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }
        file.path = `${dir}/${fileHash}-${index}`;
      },
      onError: (e) => {
        app.status = 400;
        app.body = {
          code: 400,
          msg: '上传失败',
          data: currentChunk
        }
        return;
      }
    }
  }),
  async (ctx) => {
    ctx.set('Content-Type', 'application/json');
    ctx.body = JSON.stringify({
      code: 200,
      message: 'upload successful!'
    })
  }
)

const pipeStream = (path, writeStream) => {
  return new Promise(resolve => {
    const readStream = fs.createReadStream(path);
    readStream.pipe(writeStream);
    readStream.on("end", () => {
      // fs.unlinkSync(path);
      resolve();
    });
  });
}
const mergeFileChunk = async (filePath, filename, size) => {
  const chunkDir = path.join(outputPath, filename);
  const chunkPaths = fs.readdirSync(chunkDir);
  console.log('chunkdir', chunkDir, filePath)
  if (!chunkPaths.length) return;
  // 根据下标排序
  chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1]);
  console.log("chunk path =", chunkPaths);
  await Promise.all(chunkPaths.map((chunkPath, index) => {
    pipeStream(
      path.resolve(chunkDir, chunkPath),
      fs.createWriteStream(filePath + '-' + filename, {
        start: index * size,
        end: (index + 1) * size
      })
    )
  }))
}

router.post('/mergeChunks', async (ctx) => {
  const { filename, size } = ctx.request.body;
  console.log(33, filename, size)
  // 合并chunk
  await mergeFileChunk(path.join(outputPath, filename), filename, size);
  ctx.set('Content-Type', 'application/json');
  ctx.body = JSON.stringify({
    data: {
      code: 200,
      filename,
      size
    },
    message: 'merge chunk successful'
  })
})







app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3001, (e) => {
  if (!e) {
    console.log('server is runing at prot 3001')
  }
})