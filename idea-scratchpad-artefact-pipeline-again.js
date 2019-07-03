// Artefact.pipeline a bit like promisePipe ( except e.g. with an implicit .getArtefact call on any source that is not already an artefact but is a
// mongoose model with the artefact plugin applied)

pipeline = Artefact.pipeline(pipeline =>
	new FileSys.Directory('/root/directory/scan').save().iterateFiles(),
	a => a.switch(
		[ Artefact.hasType('file'), a => a.file.doHash(false) ],		// Artefact.hasType('file') = a => a.file
		[ Artefact.hasType('dir'), a => Artefact.pipeline(
			a.dir.iterateFiles()) pipeline.append(a => a.dir.iterateFiles()) )

				a.file.hash && a.file.hash.IsCheckedSince(a.file.stats.mtime) && a.file.hash.IsCheckedSince(a.file._ts.updatedAt) ? a :
			a.file.doHash()) :
		,
	a => a.audio && a.audio.IsCheckedSince(a.file.stats.mtime) && a.audio.IsCheckedSince(a.file._ts.updatedAt) ? a :
		Audio.FromFile(a.file),
	artefact => Tags.

]
