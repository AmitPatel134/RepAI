// TODO: Update APP_NAME
const APP_NAME = "MyApp"

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <p className="font-extrabold text-2xl tracking-tight text-gray-900 animate-pulse">{APP_NAME}</p>
        <div className="w-5 h-5 border-2 border-gray-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    </div>
  )
}
