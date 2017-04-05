/* jshint node:true,mocha:true,esnext:true,eqeqeq:true,undef:true,lastsemic:true */

const assert = require('assert');
require('should');
const fs = require('fs');

const storage = require('@google-cloud/storage')({
    projectId: 'eaftc-open-source-testing',
    keyFilename: './test/storage.json'
});

const pipeToStorage = require('pipe-to-storage')(storage);
const verifyBucketMD5 = require('verify-bucket-md5')(storage);
const zipBucket = require('../index.js')(storage);

const bucket = 'eaftc-travis-testing';

function fname(path){
    return path.replace(/.*\//,'');
}

function assertFileExists(f, expected){
    return (storage
	    .bucket(bucket)
	    .file(f)
	    .exists()
	    .then(function(data){
		if (!Array.isArray(data)) throw new Error("expected array");
		if (data.length!==1) throw new Error("expected returned array to be length 1, got: "+data.length);
		if (data[0]!==expected) throw new Error("expected exists "+f+" to be "+expected+", got: "+data[0]);
		return (data[0]===expected);
	    })
	   );
}

const fromBucket = bucket;
const toBucket = bucket;
const fromPath = 'zipfodder';
const toPath = 'zipped/zip.zip';


const file1 = fromPath+'/hello.txt';
const file2 = fromPath+'/date.json';
const file3 = fromPath+'/code.js';
const md5file = fromPath+'/md5.json';

const files = [file3,file2,file1]; // sort order

function filesExist(expected){
    return Promise.all(files
		       .concat(md5file)
		       .map((f)=>(assertFileExists(f,expected)))
		      );
}

function deleteFiles(){
    return (Promise
	    .all(files
		 .concat(md5file,toPath)
		 .map( (f)=>(storage
			     .bucket(bucket)
			     .file(f)
			     .delete()
			     .catch((e)=>{})
				 ) )
		)
	   );
}

function suite(){
    it('delete test files', function(){
	return deleteFiles();
    });
    it('no files exist', function(){
	return filesExist(false).then(()=>(assertFileExists(toPath, false)));
    });
    it('create the files for testing', function(){
	return Promise.all([
	    pipeToStorage('Hello World '+Math.random(),bucket,file1),
	    pipeToStorage(new Date().toString(),bucket,file2),
	    pipeToStorage(()=>(fs.createReadStream("./index.js")), bucket, file3)
	]).then(function(info){
	    if (info.length!==3)
		throw new Error("expected info to be array of length 3, got: "+JSON.stringify(info));
	    const md5s = {};
	    info.forEach( (inf)=>{inf.file = fname(inf.file); } );
	    info.forEach( (inf)=>{ md5s[inf.file] = inf.md5; } );
	    return pipeToStorage(JSON.stringify(md5s),bucket,md5file);
	});
    });
    it('all of the input files exist', function(){
	return filesExist(true);
    });
    it('verifyBucketMD5 resolves to [true, ...]', function(){
	return (verifyBucketMD5(bucket,md5file)
		.then(function(status){
		    assert.ok(status[0]);
		})
	       );
    });
    it('zipBucket resolves without throwing error', function(){
	return zipBucket({fromBucket,fromPath,toBucket,toPath});
    });
    it('zip file exists on storage', function(){
	return assertFileExists(toPath, true);
    });
    it('delete test files', function(){
	return deleteFiles();
    });
    it('no files exist', function(){
	return filesExist(false).then(()=>(assertFileExists(toPath,false)));
    });
}

describe('bucketZip: ', suite);
