<script setup>
import { computed, onUpdated, ref } from 'vue';
import * as SparkMD5 from 'spark-md5';
import { uploadFile, mergeChunks } from "../request"


// 默认分块大小
const defaultChunkSize = 5 * 1024 * 1024;
// 当前处理文件
const currentFile = ref({});
// 当前文件分块
const fileChunkList = ref([]);


// 获取文件分块

const getFileChunk = (file, chunkSize = defaultChunkSize) => {
  return new Promise((resolve) => {
    let blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
    let chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    let spark = new SparkMD5.ArrayBuffer();
    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      console.log('read chunk number', currentChunk + 1, 'of', e);
      const chunk = e.target.result;
      spark.append(chunk);
      currentChunk++;
      if (currentChunk < chunks) {
        loadNext();
      } else {
        let fileHash = spark.end();
        console.info('finished computed hash', fileHash);
        resolve({
          fileHash
        })
      }
    }

    fileReader.onError = (e) => {
      console.warn('oops, something was wrong in split chunks')
    }

    function loadNext() {
      console.log('exec load')
      let start = currentChunk * chunkSize;
      let end = ((start + chunkSize > file.size) ? file.size : start + chunkSize);
      let chunk = blobSlice.call(file, start, end);
      fileChunkList.value.push({
        chunk,
        size: chunk.size,
        name: currentFile.value.name
      })
      // 触发readeFile onload
      fileReader.readAsArrayBuffer(chunk);
    }
    loadNext();
  })
}
// 分块进度条
const onUploadProgress = (item) => {
  return (e) => {
    item.precentage = parseInt(String(e.loaded / e.total) * 100)
  }
}

const uploadChunks = (fileHash) => {
  const requests = fileChunkList.value.map((item, index) => {
    const formData = new FormData();
    formData.append(`${currentFile.value.name}-${fileHash}-${index}`, item.chunk);
    formData.append("filename", currentFile.value.name);
    formData.append("hash", `${fileHash}-${index}`);
    formData.append('fileHash', fileHash);
    return uploadFile('/upload', formData, onUploadProgress(item))
  })

  Promise.all(requests).then((res) => {
    mergeChunks('/mergeChunks', {
      size: defaultChunkSize,
      filename: currentFile.value.name
    })
    console.log('res', res)
  })
}

const fileChange = async (e) => {
  const [file] = e.target.files;
  if (!file) return;
  currentFile.value = file;
  fileChunkList.value = [];
  let { fileHash } = await getFileChunk(file);
  console.log('filechiunklist', fileChunkList.value)
  uploadChunks(fileHash)
}
</script>
<template>
  <h1>大文件分片上传</h1>
  <input type="file" @change="fileChange" />
  <!-- <h2>总进度：{{ totalPercentage }} %</h2> -->

  <!-- <div class="percentage total">
    <p class="bg" :style="`width:${totalPercentage || 0}%`"></p>
  </div>-->
</template>
<style lang="less" scoped>
</style>