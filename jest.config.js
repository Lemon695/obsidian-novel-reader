module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1'
	},
	transform: {
		'^.+\\.tsx?$': ['ts-jest', {
			tsconfig: 'tsconfig.json'
		}]
	},
	testTimeout: 120000,
	setupFilesAfterEnv: ['./jest.setup.js'],
	verbose: true,
	// 添加 mock 设置
	moduleNameMapper: {
		'\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
			'<rootDir>/test/__mocks__/fileMock.js',
		'\\.(css|less)$': '<rootDir>/test/__mocks__/styleMock.js',
		'^canvas$': '<rootDir>/test/__mocks__/canvasMock.js'
	}
};
